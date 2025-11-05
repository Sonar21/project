"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { db } from "@/firebase/clientApp";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  limit,
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
      const gradeMap = {
        1: "1年生",
        2: "2年生",
        3: "3年生",
        4: "4年生",
      };
      const grade = gradeMap[gradeNum] || `${gradeNum}年生`;

      // ✅ Firestore の courses コレクションから一致するコースを検索
      const coursesRef = collection(db, "courses");
      const q = query(coursesRef, where("year", "==", grade), limit(1));
      const snapshot = await getDocs(q);

      let courseId = "unknown";
      let courseKey = "unknown";

      if (!snapshot.empty) {
        const courseDoc = snapshot.docs[0];
        courseId = courseDoc.id;
        courseKey = courseDoc.data().courseKey || "unknown";
      }

      // ✅ Firestore に学生データを登録・更新
      await setDoc(
        doc(db, "students", email),
        {
          studentId,
          email,
          name,
          nameKana,
          startMonth,
          courseId,
          courseKey,
          entranceYear,
          grade,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`✅ 学生登録完了: ${email} → ${entranceYear} 入学 → ${grade}`);
    };

    registerStudentIfNeeded();
  }, [session]);

  return null;
}
