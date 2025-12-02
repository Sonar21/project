"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { db } from "@/firebase/clientApp";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";

// Lightweight component: ensures a logged-in user has a students/<studentId>
// document and performs a transactional create + course.students increment.
// It guards itself to run only once per session (per-page load) to avoid
// duplicate increments caused by effects re-running during HMR or status
// flaps.
export default function StudentAutoRegister() {
  const { data: session, status } = useSession();
  const lastRegisteredRef = useRef(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!session?.user?.email) return;

    const doRegister = async () => {
      const email = session.user.email;
      // studentId: historically the project used local-part of email
      const studentId = String(email).split("@")[0];

      if (lastRegisteredRef.current === studentId) {
        // already attempted this session
        return;
      }

      // mark as attempted for this session
      lastRegisteredRef.current = studentId;

      const determineCourseKey = async (studentId) => {
        const id = String(studentId || "")
          .toLowerCase()
          .trim();
        if (!id) return "unknown";
        const first = id.charAt(0);
        switch (first) {
          case "j":
            return "japanese";
          case "k":
            return "kokusai";
          case "i":
            return "it";
          case "w":
            return "web";
          case "f":
            return "global";
          case "h":
            return "hotel";
          default:
            return "unknown";
        }
      };

      const saveStudentWithAutoCourse = async () => {
        try {
          const studentRef = doc(db, "students", studentId);
          const snap = await getDoc(studentRef);

          // determine courseKey heuristically
          const courseKey = await determineCourseKey(studentId);

          if (snap.exists()) {
            // For existing students: re-calculate grade on every login using
            // academic year that starts in April, but do NOT adjust course counts.
            const existing = snap.data() || {};

            // Determine entranceYear: prefer stored value, fallback to parse from id
            const parsedYearCode = parseInt(String(studentId).slice(1, 3), 10);
            let parsedEntranceYear =
              2000 + (Number.isFinite(parsedYearCode) ? parsedYearCode : 0);
            const today = new Date();
            const academicYear =
              today.getMonth() + 1 >= 4
                ? today.getFullYear()
                : today.getFullYear() - 1;
            if (parsedEntranceYear > academicYear) parsedEntranceYear -= 100;

            const entranceYear = existing.entranceYear || parsedEntranceYear;

            const gradeNum = academicYear - entranceYear + 1;
            const gradeMapJP = {
              1: "1年生",
              2: "2年生",
              3: "3年生",
              4: "4年生",
            };
            const gradeJP = gradeMapJP[gradeNum] || `${gradeNum}年生`;
            const ordinal = (n) => {
              if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
              switch (n % 10) {
                case 1:
                  return `${n}st`;
                case 2:
                  return `${n}nd`;
                case 3:
                  return `${n}rd`;
                default:
                  return `${n}th`;
              }
            };
            const gradeEN = `${ordinal(gradeNum)} Year`;

            // Prepare updates: update name minimally and update grade fields if changed.
            const updates = {};
            const name = session.user?.name || "";
            if (name && name !== existing.name) updates.name = name;
            if (gradeEN && gradeEN !== existing.grade) updates.grade = gradeEN;
            if (gradeJP && gradeJP !== existing.gradeJP)
              updates.gradeJP = gradeJP;
            if (entranceYear && entranceYear !== existing.entranceYear)
              updates.entranceYear = entranceYear;

            if (Object.keys(updates).length > 0) {
              try {
                updates.updatedAt = serverTimestamp();
                // do not touch course counts for existing users
                await updateDoc(studentRef, updates);
              } catch (e) {
                console.warn(
                  "[StudentAutoRegister] failed to update existing student:",
                  e
                );
              }
            }

            return;
          }

          // compute entranceYear and grade labels (academic year starts in April)
          const yearCode = parseInt(String(studentId).slice(1, 3), 10);
          const today = new Date();
          const academicYear =
            today.getMonth() + 1 >= 4
              ? today.getFullYear()
              : today.getFullYear() - 1;
          let entranceYear = 2000 + (Number.isFinite(yearCode) ? yearCode : 0);
          if (entranceYear > academicYear) entranceYear -= 100;
          const gradeNum = academicYear - entranceYear + 1;
          const gradeMapJP = {
            1: "1年生",
            2: "2年生",
            3: "3年生",
            4: "4年生",
          };
          const gradeJP = gradeMapJP[gradeNum] || `${gradeNum}年生`;
          const ordinal = (n) => {
            if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
            switch (n % 10) {
              case 1:
                return `${n}st`;
              case 2:
                return `${n}nd`;
              case 3:
                return `${n}rd`;
              default:
                return `${n}th`;
            }
          };
          const gradeEN = `${ordinal(gradeNum)} Year`;

          const name = session.user?.name || "未設定";

          // Try to resolve a matching course document (prefer same courseKey + year)
          let resolvedCourseDocId = null;
          try {
            let qsnap = null;
            if (courseKey && courseKey !== "unknown") {
              try {
                qsnap = await getDocs(
                  query(
                    collection(db, "courses"),
                    where("courseKey", "==", courseKey),
                    where("year", "==", gradeEN),
                    limit(1)
                  )
                );
              } catch (e) {
                qsnap = null;
              }

              if ((!qsnap || qsnap.empty) && gradeJP) {
                try {
                  qsnap = await getDocs(
                    query(
                      collection(db, "courses"),
                      where("courseKey", "==", courseKey),
                      where("year", "==", gradeJP),
                      limit(1)
                    )
                  );
                } catch (e) {
                  qsnap = null;
                }
              }

              if (!qsnap || qsnap.empty) {
                qsnap = await getDocs(
                  query(
                    collection(db, "courses"),
                    where("courseKey", "==", courseKey),
                    limit(1)
                  )
                );
              }

              if (qsnap && !qsnap.empty) resolvedCourseDocId = qsnap.docs[0].id;
            }
          } catch (err) {
            console.warn("Failed to resolve course doc for increment:", err);
          }

          // perform transaction: create student doc and increment course.students
          await runTransaction(db, async (transaction) => {
            const sSnap = await transaction.get(studentRef);
            if (sSnap.exists()) return; // created concurrently

            const payload = {
              studentId,
              email,
              name,
              nameKana: "",
              startMonth: new Date().toISOString().slice(0, 7),
              courseId: courseKey,
              courseKey,
              courseDocId: resolvedCourseDocId,
              entranceYear,
              grade: gradeEN,
              gradeJP,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            transaction.set(studentRef, payload);

            if (resolvedCourseDocId) {
              const courseDocRef = doc(db, "courses", resolvedCourseDocId);
              transaction.update(courseDocRef, {
                students: increment(1),
                updatedAt: serverTimestamp(),
              });
            }
          });

          console.log(
            "[StudentAutoRegister] registered student:",
            studentId,
            "courseKey:",
            courseKey
          );
        } catch (err) {
          console.error("[StudentAutoRegister] registration failed:", err);
        }
      };

      // fire-and-forget registration (transaction encapsulates safety)
      saveStudentWithAutoCourse();
    };

    doRegister();
  }, [status, session]);

  return null;
}
