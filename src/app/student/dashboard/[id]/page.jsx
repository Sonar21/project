"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams } from "next/navigation";
import { db } from "@/firebase/clientApp";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  increment,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import styles from "./page.module.css";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const { id } = useParams(); // 👈 dynamic student id from URL (/student/dashboard/[id])

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseTuition, setCourseTuition] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [computedTuition, setComputedTuition] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState([]);

  // -----------------------------------------
  // 🔹 Handle receipt upload
  // -----------------------------------------
  const handleReceiptUpload = async () => {
    if (!file || !student) return alert("ファイルを選択してください。");

    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return alert("有効な金額を入力してください（例: 80000）");
    }
    setUploading(true);

    try {
      const storage = getStorage();
      const fileRef = ref(
        storage,
        `receipts/${student.studentId}/${Date.now()}_${file.name}`
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const paymentsRef = collection(db, "payments");
      const paymentPayload = {
        studentId: student.studentId,
        course: student.courseId || "未設定",
        receiptUrl: url,
        amount: numericAmount,
        paymentMethod: "銀行振込",
        status: "支払い済み",
        createdAt: serverTimestamp(),
      };

      const paymentDocRef = await addDoc(paymentsRef, paymentPayload);
      const monthValue =
        student.startMonth || new Date().toISOString().slice(0, 7);

      await updateDoc(doc(db, "payments", paymentDocRef.id), {
        paymentId: paymentDocRef.id,
        uploadedAt: serverTimestamp(),
        verified: false,
        month: monthValue,
      });

      alert("支払い情報を保存しました！");
      setFile(null);
      setAmount("");
    } catch (err) {
      console.error("アップロードエラー:", err);
      alert("アップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  };

  // -----------------------------------------
  // 🔹 Load student data
  // -----------------------------------------
  useEffect(() => {
    if (status !== "authenticated" && !id) {
      setLoading(false);
      return;
    }

    const studentId =
      id || session?.user?.studentId || session?.user?.email?.split("@")[0];

    if (!studentId) {
      setStudent(null);
      setLoading(false);
      return;
    }

    const studentRef = doc(db, "students", String(studentId));
    const unsub = onSnapshot(
      studentRef,
      async (snap) => {
        if (snap.exists()) {
          setStudent({ ...snap.data(), studentId });
        } else {
          setStudent(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Student snapshot error:", err);
        setStudent(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [status, session, id]);

  // -----------------------------------------
  // 🔹 Auto register student (for students only)
  // -----------------------------------------
  useEffect(() => {
    const determineCourseKey = async (studentId, email) => {
      const id = String(studentId || "").toLowerCase().trim();
      const name = id.replace(/\s+/g, "").replace("コース", "").replace("科", "");
      const nameMap = {
        japanese: ["日本語ビジネス", "日本語ビジネスコース", "japanese"],
        kokusai: ["国際ビジネス", "国際ビジネスコース", "international"],
        it: ["情報技術", "it", "itコース"],
        web: ["web", "ウェブ"],
        global: ["グローバル", "global"],
      };
      for (const [key, values] of Object.entries(nameMap)) {
        if (values.some((v) => name.includes(v))) return key;
      }
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
        default:
          return "unknown";
      }
    };

    const saveStudentWithAutoCourse = async (studentId, email) => {
      const courseKey = await determineCourseKey(studentId, email);
      const studentRef = doc(db, "students", studentId);
      const snap = await getDoc(studentRef);
      if (!snap.exists()) {
        const payload = {
          studentId,
          email,
          name: session.user?.name || "未設定",
          courseId: courseKey,
          startMonth: new Date().toISOString().slice(0, 7),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(studentRef, payload);
        console.log("✅ 新しい学生を登録しました:", studentId);
      }
    };

    if (status === "authenticated" && !id) {
      const email = session?.user?.email;
      const studentId = email?.split("@")[0];
      if (studentId) saveStudentWithAutoCourse(studentId, email);
    }
  }, [status, session, id]);

  // -----------------------------------------
  // 🔹 Get course info
  // -----------------------------------------
  useEffect(() => {
    const fetchCourse = async () => {
      if (!student?.courseId) {
        setCourseInfo(null);
        setComputedTuition(null);
        return;
      }

      try {
        const q = query(
          collection(db, "courses"),
          where("courseKey", "==", student.courseId),
          limit(1)
        );
        const qsnap = await getDocs(q);
        if (!qsnap.empty) {
          const d = qsnap.docs[0].data();
          const totalFee =
            Number(d.pricePerMonth) || Number(d.fee) || Number(d.tuition) || 0;
          setCourseInfo({
            id: qsnap.docs[0].id,
            name: d.name || "未設定",
            pricePerMonth: totalFee,
          });
          setComputedTuition(totalFee);
        }
      } catch (err) {
        console.error("コース取得エラー:", err);
      }
    };
    fetchCourse();
  }, [student?.courseId]);

  // -----------------------------------------
  // 🔹 Real-time payments
  // -----------------------------------------
  useEffect(() => {
    if (!student?.studentId) return;

    const paymentsRef = collection(db, "payments");
    const q = query(
      paymentsRef,
      where("studentId", "==", student.studentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPayments(data);
    });

    return () => unsub();
  }, [student?.studentId]);

  // -----------------------------------------
  // 🔹 Loading and login states
  // -----------------------------------------
  if (status === "loading" || loading) {
    return (
      <div className={styles.center}>
        <h3>読み込み中です...</h3>
      </div>
    );
  }

  if (status === "unauthenticated" && !id) {
    return (
      <div className={styles.center}>
        <h2>サインインしてください</h2>
        <button className={styles.primaryBtn} onClick={() => signIn()}>
          サインイン
        </button>
      </div>
    );
  }

  // -----------------------------------------
  // 🔹 Payment progress
  // -----------------------------------------
  const total = Number(
    courseInfo?.pricePerMonth ??
      computedTuition ??
      courseTuition ??
      student?.totalFees ??
      0
  );
  const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(total - paid, 0);
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  // -----------------------------------------
  // 🔹 Render
  // -----------------------------------------
  return (
    <main className={styles.container}>
      <button onClick={() => window.history.back()} className="mb-4">
        ← 戻る
      </button>

      <header className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "overview" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          概要
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "history" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("history")}
        >
          履歴
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "profile" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("profile")}
        >
          プロフィール
        </button>
      </header>

      {activeTab === "overview" && (
  <section className={styles.container}>
    <h2 className={styles.header}>支払い状況</h2>

    <div className={styles.courseBox}>
      コース: {courseInfo?.name || student?.courseId || "unknown"}
    </div>

    <div className={styles.progressContainer}>
      <div className={styles.progressLabel}>
        <span>支払い進捗</span>
        <span>{progress.toFixed(1)}%</span>
      </div>
      <div className={styles.progressBarWrap}>
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <div className={styles.card}>
        <p className={styles.cardTitle}>総学費</p>
        <p className={styles.cardValue}>{total.toLocaleString()}円</p>
      </div>
      <div className={styles.card}>
        <p className={styles.cardTitle}>支払い済み</p>
        <p className={styles.cardValue}>{paid.toLocaleString()}円</p>
      </div>
      <div className={styles.card}>
        <p className={styles.cardTitle}>残り</p>
        <p className={styles.cardValue}>{remaining.toLocaleString()}円</p>
      </div>
    </div>
  </section>
)}


      {activeTab === "history" && (
        <section className={styles.card}>
          <h2>支払い履歴</h2>
          <table className={styles.paymentTable}>
            <thead>
              <tr>
                <th>日付</th>
                <th>金額</th>
                <th>状態</th>
                <th>アップロード</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const date = p.createdAt?.toDate
                  ? p.createdAt.toDate()
                  : new Date();
                const formattedDate = date.toLocaleDateString("ja-JP");
                return (
                  <tr key={p.id}>
                    <td>{formattedDate}</td>
                    <td>¥{p.amount?.toLocaleString()}</td>
                    <td>{p.status}</td>
                    <td>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files[0])}
                      />
                      <button
                        onClick={handleReceiptUpload}
                        disabled={uploading}
                      >
                        {uploading ? "アップロード中..." : "アップロード"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2>プロフィール</h2>
          <p>名前: {student?.name}</p>
          <p>メール: {student?.email || session?.user?.email}</p>
          <p>学籍番号: {student?.studentId}</p>
          <p>コース: {student?.courseId}</p>
        </section>
      )}
    </main>
  );
}
