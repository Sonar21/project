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
  getDocs,
  getDoc,
  setDoc,
  limit,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import styles from "./page.module.css";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseTuition, setCourseTuition] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null); // { id, pricePerMonth, createdAt, updatedAt, name }
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
      const paymentPayload = {
        studentId: student.studentId,
        course: student.courseId || "未設定",
        receiptUrl: url,
        amount: numericAmount, // 入力金額
        paymentMethod: "銀行振込", // 支払い方法（例）
        status: "支払い済み", // 支払い状態
        createdAt: serverTimestamp(), // 支払った日時（自動）
      };

      const paymentDocRef = await addDoc(paymentsRef, paymentPayload);

      // 追加フィールド: paymentId, uploadedAt, verified, month
      const monthValue =
        student.startMonth || new Date().toISOString().slice(0, 7); // YYYY-MM
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

  // 🔹 Googleログイン後、自動で students に登録
  useEffect(() => {
    const registerStudentIfNeeded = async () => {
      if (!session?.user?.email) return;

      const email = session.user.email;
      const studentId = email.split("@")[0]; // 例: w24001@school.jp → w24001
      const courseId = studentId.startsWith("w") ? "web" : "unknown"; // 学籍番号の頭文字で判定

      const studentRef = doc(db, "students", studentId);
      const snap = await getDoc(studentRef);

      if (!snap.exists()) {
        await setDoc(studentRef, {
          studentId,
          email,
          name: session.user.name || "未設定",
          nameKana: "",
          courseId,
          startMonth: new Date().toISOString().slice(0, 7),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log("✅ 新しい学生を登録しました:", studentId);
      }
    };

    if (status === "authenticated") {
      registerStudentIfNeeded();
    }
  }, [status, session]);

  // 🔹 コース情報を取得
  useEffect(() => {
    const fetchCourse = async () => {
      if (!student?.courseId) {
        setCourseInfo(null);
        setComputedTuition(null);
        return;
      }

      try {
        // 1️⃣ courseId が "web" のような短縮文字列 → Firestore内の name フィールドと照合
        const q = query(
          collection(db, "courses"),
          where("name", ">=", student.courseId),
          where("name", "<=", student.courseId + "\uf8ff"),
          limit(1)
        );

        const qsnap = await getDocs(q);

        if (!qsnap.empty) {
          const docSnap = qsnap.docs[0];
          const d = docSnap.data();

          // 2️⃣ 金額の取得優先順位
          const totalFee =
            Number(d.pricePerMonth) ||
            Number(d.fee) ||
            Number(d.tuition) ||
            0;

          // 3️⃣ コース情報を保存
          setCourseInfo({
            id: docSnap.id,
            name: d.name || "未設定",
            pricePerMonth: totalFee,
          });
          setComputedTuition(totalFee);
        } else {
          console.warn("コースが見つかりません:", student.courseId);
          setCourseInfo(null);
          setComputedTuition(null);
        }
      } catch (err) {
        console.error("コース取得エラー:", err);
        setCourseInfo(null);
        setComputedTuition(null);
      }
    };

    fetchCourse();
  }, [student?.courseId]);

  // 🔹 支払い履歴をリアルタイム取得
  useEffect(() => {
    if (!student?.studentId) return;

    const paymentsRef = collection(db, "payments");
    const q = query(
      paymentsRef,
      where("studentId", "==", student.studentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPayments(data);
      },
      (err) => {
        console.error("Payments snapshot error:", err);
        // Firestore may require a composite index when combining where() and orderBy() on different fields.
        // The error.message usually includes a direct URL to create the index in Firebase Console — log it so developers can click it.
        if (err && err.message) {
          console.warn("Firestore index required or query failed:", err.message);
        }
      }
    );

    return () => unsub();
  }, [student?.studentId]);


  // (旧来の詳細フェッチは廃止) 単一の fetchCourse useEffect を使っているため、ここは削除しました。

  // 🔹 支払い履歴をリアルタイム取得
  useEffect(() => {
    if (!student?.studentId) return;

    const paymentsRef = collection(db, "payments");
    const q = query(
      paymentsRef,
      where("studentId", "==", student.studentId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPayments(data);
      },
      (err) => {
        console.error("Payments snapshot error:", err);
        // Firestore may require a composite index when combining where() and orderBy() on different fields.
        // The error.message usually includes a direct URL to create the index in Firebase Console — log it so developers can click it.
        if (err && err.message) {
          console.warn("Firestore index required or query failed:", err.message);
        }
      }
    );

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
  // total: prefer courseInfo.pricePerMonth, then computedTuition, courseTuition, student.totalFees
  const total = Number(
    courseInfo?.pricePerMonth ??
      computedTuition ??
      courseTuition ??
      student?.totalFees ??
      0
  );

  // paid: sum of payments amounts from Firestore (real-time)
  const paidFromPayments = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const paid = paidFromPayments || Number(student?.paidAmount || 0);

  const remaining = Math.max(total - paid, 0);
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
              コース:{" "}
              {courseInfo?.name ??
                student?.courseId ??
                session.user.courseName ??
                "未設定"}
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
