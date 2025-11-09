"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { db } from "@/firebase/clientApp";
import {
  doc,
  setDoc,
  getDoc,
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

    const email = session.user.email;
    // studentId: historically the project used local-part of email
    const studentId = String(email).split("@")[0];

    if (lastRegisteredRef.current === studentId) {
      // already attempted this session
      return;
    }

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
          // ensure minimal fields are up-to-date but do not change counts
          const existing = snap.data() || {};
          const updates = {};
          const name = session.user?.name || "";
          if (name && name !== existing.name) updates.name = name;
          if (Object.keys(updates).length > 0) {
            await runTransaction(db, async (transaction) => {
              const s = await transaction.get(studentRef);
              if (!s.exists()) return; // someone removed it?
              transaction.update(studentRef, updates);
            });
          }
          return;
        }

        // compute entranceYear and grade labels
        const yearCode = parseInt(String(studentId).slice(1, 3), 10);
        const currentYear = new Date().getFullYear();
        let entranceYear = 2000 + (Number.isFinite(yearCode) ? yearCode : 0);
        if (entranceYear > currentYear) entranceYear -= 100;
        const gradeNum = currentYear - entranceYear + 1;
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
  }, [status, session]);

  return null;
}
