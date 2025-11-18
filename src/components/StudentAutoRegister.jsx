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

        const gradeNum = currentYear - entranceYear + 1;
        const gradeMapJP = {
          1: "1年生",
          2: "2年生",
          3: "3年生",
          4: "4年生",
        };
        const gradeJP = gradeMapJP[gradeNum] || `${gradeNum}年生`;

        // courses コレクションの Year フィールドは英語の "1st Year" などが使われているため
        // 英語表記も作っておく
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
        const gradeEN = `${ordinal(gradeNum)} Year`; // 例: "1st Year"

        // ✅ Firestore の courses コレクションから一致するコースを検索
        const coursesRef = collection(db, "courses");
        // まず英語表記で検索し、なければ日本語表記でフォールバックする
        let q = query(coursesRef, where("year", "==", gradeEN), limit(1));
        let snapshot = await getDocs(q);
        if (snapshot.empty) {
          q = query(coursesRef, where("year", "==", gradeJP), limit(1));
          snapshot = await getDocs(q);
        }

        let courseDocId = "unknown";
        let courseKey = "unknown";
        let courseRef = null;

        if (!snapshot.empty) {
          const courseDoc = snapshot.docs[0];
          courseDocId = courseDoc.id;
          courseKey = courseDoc.data().courseKey || "unknown";
          courseRef = doc(db, "courses", courseDocId);
        }

        // student ドキュメントが存在するか確認して、初回作成時のみコース側の students を増やす
        const studentRef = doc(db, "students", email);
        const studentSnap = await getDoc(studentRef);
        const isNewStudent = !studentSnap.exists();

        if (isNewStudent) {
          // 新規作成: createdAt をつける（updatedAt は不要）
          await setDoc(
            studentRef,
            {
              studentId,
              email,
              name,
              nameKana,
              startMonth,
              // `courseId` stored on students is the courseKey (短いキー)。
              courseId: courseKey,
              courseKey,
              // 保存しておくとコース移動のときに古いドキュメントを特定しやすい
              courseDocId,
              entranceYear,
              // 両方入れておくと他の画面で壊れにくい
              grade: gradeEN,
              gradeJP,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          // コースの students カウントを増やす（存在する場合のみ）
          if (courseRef) {
            try {
              await updateDoc(courseRef, { students: increment(1) });
            } catch (e) {
              console.warn(
                "[StudentAutoRegister] failed to increment course students",
                e
              );
            }
          }
        } else {
          // 既存ユーザ: 不要な updatedAt の更新は避けるが、名前などが変わっていれば最小限更新
          const existing = studentSnap.data() || {};
          const updates = {};
          if (name && name !== existing.name) updates.name = name;
          if (nameKana && nameKana !== existing.nameKana)
            updates.nameKana = nameKana;
          if (courseKey && courseKey !== existing.courseId) {
            // courseId on students is courseKey. 更新内容に courseKey を入れる。
            updates.courseId = courseKey;
            updates.courseKey = courseKey;
            updates.courseDocId = courseDocId;
            try {
              // 新しいコースの students を +1
              if (courseRef) {
                await updateDoc(courseRef, { students: increment(1) });
              }
              // 古いコースのドキュメントID が保存されていれば -1
              const oldDocId = existing.courseDocId;
              if (oldDocId) {
                const oldCourseRef = doc(db, "courses", oldDocId);
                await updateDoc(oldCourseRef, { students: increment(-1) });
              }
            } catch (e) {
              console.warn(
                "[StudentAutoRegister] failed to adjust course students on move",
                e
              );
            }
          }
          // grade 表記が変わっていれば更新
          if (
            (gradeEN && gradeEN !== existing.grade) ||
            (gradeJP && gradeJP !== existing.gradeJP)
          ) {
            updates.grade = gradeEN;
            updates.gradeJP = gradeJP;
          }

          if (Object.keys(updates).length > 0) {
            await setDoc(studentRef, updates, { merge: true });
          }
        }

        console.log(
          `✅ 学生登録完了: ${email} → ${entranceYear} 入学 → ${gradeJP} / ${gradeEN} (${
            isNewStudent ? "new" : "exists"
          })`
        );

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
    };

    doRegister();
  }, [status, session]);

  return null;
}