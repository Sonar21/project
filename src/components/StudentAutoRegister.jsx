"use client";

import { useEffect } from "react";
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
  serverTimestamp,
  limit,
  increment,
} from "firebase/firestore";

export default function StudentAutoRegister() {
  const { data: session } = useSession();

  useEffect(() => {
    const registerStudentIfNeeded = async () => {
      if (!session?.user) return;

      const email = session.user.email;
      const studentId = email.split("@")[0]; // 例: j23001
      const name = session.user.name || "";
      const nameKana = "";
      const startMonth = new Date().toISOString().slice(0, 7); // 例: "2025-11"

      // ✅ 入学年度・学年を自動判定
      const yearCode = parseInt(studentId.slice(1, 3), 10); // "23" → 23
      const currentYear = new Date().getFullYear(); // 例: 2025
      let entranceYear = 2000 + yearCode;
      if (entranceYear > currentYear) entranceYear -= 100; // 2100年対策

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
    };

    registerStudentIfNeeded();
  }, [session]);

  return null;
}
