"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
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
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import styles from "./page.module.css";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseTuition, setCourseTuition] = useState(null);
  const [computedTuition, setComputedTuition] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // タブ状態
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState([]); // 🔹 支払い履歴を保存する配列

  // 📸 レシートアップロード関数（支払い情報を記録）
  const handleReceiptUpload = async () => {
    if (!file || !student) return alert("ファイルを選択してください。");

    // 金額チェック
    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return alert("有効な金額を入力してください（例: 80000）");
    }
    setUploading(true);

    try {
      // 1️⃣ Storage にファイルをアップロード
      const storage = getStorage();
      const fileRef = ref(
        storage,
        `receipts/${student.studentId}/${Date.now()}_${file.name}`
      );
      await uploadBytes(fileRef, file);

      // 2️⃣ URLを取得
      const url = await getDownloadURL(fileRef);

      // 3️⃣ Firestoreに支払い情報を追加
      const paymentsRef = collection(db, "payments");
      await addDoc(paymentsRef, {
        studentId: student.studentId,
        course: student.course || "未設定",
        receiptUrl: url,
        amount: numericAmount, // 入力金額
        paymentMethod: "銀行振込", // 支払い方法（例）
        status: "支払い済み", // 支払い状態
        createdAt: serverTimestamp(), // 支払った日時（自動）
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

  // 🔹 ログイン中の学生情報をFirestoreからリアルタイム取得
  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    const studentId =
      session?.user?.studentId ||
      String(session?.user?.email || "").split("@")[0];
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
  }, [status, session]);

  // 🔹 コースの学費をリアルタイム取得
  //  学生IDの先頭文字でコース判定・次の2桁で入学年を判定し、
  //  Firestore の courses ドキュメント内の tuitionByYear フィールドを優先して学年別学費を取得します。
  useEffect(() => {
    if (!student?.course) {
      setCourseTuition(null);
      setComputedTuition(null);
      return;
    }
    const docRef = doc(db, "courses", String(student.course));
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setCourseTuition(null);
          setComputedTuition(null);
          return;
        }
        const d = snap.data() || {};
        setCourseTuition(Number(d?.tuition) || 0);

        // compute student year from studentId: e.g. w24002 -> cohort 24 -> cohortYear 2024
        const sid = String(student.studentId || "");
        let studentYear = 1;
        if (sid.length >= 3) {
          const cohortDigits = sid.slice(1, 3);
          if (!Number.isNaN(Number(cohortDigits))) {
            const cohortFull = 2000 + Number(cohortDigits);
            const nowYear = new Date().getFullYear();
            studentYear = nowYear - cohortFull + 1;
            if (studentYear < 1) studentYear = 1;
            if (studentYear > 10) studentYear = 10;
          }
        }

        // Prefer tuitionByYear in Firestore (object with keys '1','2',... or 'default')
        let t = null;
        if (d?.tuitionByYear && typeof d.tuitionByYear === "object") {
          const byYear = d.tuitionByYear;
          if (byYear[String(studentYear)] !== undefined) {
            t = Number(byYear[String(studentYear)]) || null;
          } else if (byYear["default"] !== undefined) {
            t = Number(byYear["default"]) || null;
          }
        }

        if (t === null) t = Number(d?.tuition) || 0;
        setComputedTuition(t);
      },
      (err) => {
        console.error("Course snapshot error:", err);
        setCourseTuition(null);
        setComputedTuition(null);
      }
    );
    return () => unsub();
  }, [student?.course, student?.studentId]);

  // 🔹 支払い履歴をリアルタイム取得
  useEffect(() => {
    if (!student?.studentId) return;

    const paymentsRef = collection(db, "payments");
    const q = query(
      paymentsRef,
      where("studentId", "==", student.studentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPayments(data);
    });

    return () => unsub();
  }, [student?.studentId]);

  // 🔹 ローディング・未ログイン時の表示
  if (status === "loading" || loading) {
    return (
      <div className={styles.center}>
        <h3>読み込み中です...</h3>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.center}>
        <h2>サインインしてください</h2>
        <button className={styles.primaryBtn} onClick={() => signIn()}>
          サインイン
        </button>
      </div>
    );
  }

  // 🔹 支払い状況計算
  const total = (computedTuition ?? courseTuition ?? student?.totalFees) || 0;
  const paid = student?.paidAmount || 0;
  const remaining = total - paid;
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  // Compute student academic year for display (same logic as used for tuition calculation)
  let displayStudentYear = null;
  if (student?.studentId) {
    const sid = String(student.studentId);
    if (sid.length >= 3) {
      const cohortDigits = sid.slice(1, 3);
      if (!Number.isNaN(Number(cohortDigits))) {
        const cohortFull = 2000 + Number(cohortDigits);
        const nowYear = new Date().getFullYear();
        displayStudentYear = nowYear - cohortFull + 1;
        if (displayStudentYear < 1) displayStudentYear = 1;
      }
    }
  }

  return (
    <main className={styles.container}>
      {/* 🔹 タブメニュー */}
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

      {/* 🔹 概要タブ */}
      {activeTab === "overview" && (
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況</h1>

          <div className={styles.infoBox}>
            <div>
              コース: {student?.course || session.user.courseName || "未設定"}
            </div>
            <div>
              学年: {displayStudentYear ? `${displayStudentYear}年` : "不明"} —
              この学年の学費: {total.toLocaleString()}円
            </div>
          </div>
          <div className={styles["progress-row"]}>
            <span className={styles.label}>支払い進捗</span>
            <span className={styles.percent}>{progress.toFixed(1)}%</span>
          </div>
          <div className={styles["progress-wrap"]}>
            <div
              className={styles["progress-bar"]}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.stats}>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>総学費</div>
              <div className={styles["stat-value"]}>
                {total.toLocaleString()}円
              </div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>支払い済み</div>
              <div className={`${styles["stat-value"]} ${styles.paid}`}>
                {paid.toLocaleString()}円
              </div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>残り</div>
              <div className={`${styles["stat-value"]} ${styles.remain}`}>
                {remaining.toLocaleString()}円
              </div>
            </article>
          </div>
        </section>
      )}

      {/* 🔹 履歴タブ */}
      {activeTab === "history" && (
        <section className={styles.card}>
          <h2 className={styles.title}>支払い履歴</h2>

          <table className={styles.paymentTable}>
            <thead>
              <tr>
                <th>日付</th>
                <th>時間</th>
                <th>金額</th>
                <th>状態</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const date = p.createdAt?.toDate
                  ? p.createdAt.toDate()
                  : new Date();
                //  日付と時間を日本語形式で表示
                const formattedDate = date.toLocaleDateString("ja-JP");
                const formattedTime = date.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <tr key={p.id}>
                    <td>{formattedDate}</td>
                    <td>{formattedTime}</td>
                    <td>¥{p.amount?.toLocaleString()}</td>
                    <td>{p.paymentMethod || "-"}</td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          p.status === "支払い済み"
                            ? styles.paid
                            : styles.unpaid
                        }`}
                      >
                        {p.status}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files[0])}
                      />{" "}
                      <button
                        onClick={handleReceiptUpload}
                        disabled={uploading}
                      >
                        {" "}
                        {uploading ? "アップロード中..." : "アップロード"}{" "}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* 🔹 プロフィールタブ */}
      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2>プロフィール情報</h2>
          <p>名前: {student?.name || session.user.name}</p>
          <p>メール: {session.user.email}</p>
          <p>学籍番号: {student?.studentId || "未登録"}</p>
        </section>
      )}
    </main>
  );
}
