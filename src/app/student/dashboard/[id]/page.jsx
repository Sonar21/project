"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { db } from "@/firebase/clientApp";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import styles from "./page.module.css";
import receiptStyles from "@/components/ReceiptList.module.css";
import PaymentSchedule from "@/components/PaymentSchedule";
import migrateRemainingToNextYear from "@/lib/migrateYearTuition";
import { useParams } from "next/navigation";

// This file is a cleaned-up, single-shot-read variant of the student dashboard
// for a route that includes a student id. It mirrors the main dashboard but
// uses `routeId` (from params) as the student identifier when present.
export default function StudentDashboardIdPage() {
  const { data: session, status } = useSession();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseTuition, setCourseTuition] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [computedTuition, setComputedTuition] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [amount, setAmount] = useState("");
  const [receiptMonth, setReceiptMonth] = useState("");
  const [payments, setPayments] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const params = useParams();
  const routeId = params?.id;
  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [migrating, setMigrating] = useState(false);

  // sync discount from student doc when it loads
  useEffect(() => {
    if (student && typeof student.discount !== "undefined") {
      const v = Number(student.discount) || 0;
      setDiscount(v);
      setDiscountInput(String(v || ""));
      setDiscountReason(student.discountReason || "");
    }
  }, [student]);

  const handleDiscountChange = async (value) => {
    const v = Number(value) || 0;
    // optimistic update: update local state immediately so UI reflects change
    const prevStudentDiscount = student?.discount;
    const prevReason = student?.discountReason;
    try {
      setDiscount(v);
      setDiscountInput(String(v || ""));
      if (student && student.id) {
        setStudent((prev) => (prev ? { ...prev, discount: v } : prev));
      }

      if (!student?.id) return;

      const actor = session?.user?.email || session?.user?.name || null;
      await updateDoc(doc(db, "students", student.id), {
        discount: v,
        discountReason: discountReason || null,
        discountReasonBy: actor,
        discountReasonAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // update local student state to reflect saved reason and metadata
      setStudent((s) => ({
        ...(s || {}),
        discount: v,
        discountReason: discountReason || null,
        discountReasonBy: actor,
        discountReasonAt: new Date(),
      }));
    } catch (err) {
      console.error("Failed to save discount:", err);
      // rollback local optimistic state
      setDiscount(Number(prevStudentDiscount) || 0);
      setDiscountInput(String(prevStudentDiscount || ""));
      setDiscountReason(prevReason || "");
      if (student && student.id) {
        setStudent((prev) =>
          prev
            ? {
                ...prev,
                discount: prevStudentDiscount,
                discountReason: prevReason,
              }
            : prev
        );
      }
      alert("割引の保存に失敗しました。コンソールを確認してください。");
    }
  };

  // Wrapper to validate both fields before saving
  const saveDiscount = async () => {
    setDiscountError("");
    const reason = String(discountReason || "").trim();
    const amountRaw = String(discountInput || "").trim();
    if (!reason) {
      setDiscountError("割引理由を入力してください。");
      return;
    }
    if (!amountRaw) {
      setDiscountError("減免金額を入力してください。");
      return;
    }
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0) {
      setDiscountError(
        "有効な減免金額を入力してください（0 より大きい数値）。"
      );
      return;
    }

    // call existing handler which performs optimistic update and saves to Firestore
    await handleDiscountChange(amountRaw);
    setDiscountError("");
  };

  // Year migration: move unpaid remainder from previous year to next year
  const handleMigrateYear = async () => {
    if (!student?.id) return alert("学生情報が見つかりません。");
    if (
      !session?.user ||
      !(session.user.isAdmin || session.user.role === "teacher")
    ) {
      return alert("権限がありません。");
    }

    const confirmed = confirm(
      "未払い残高を次年度に移行します。実行してよろしいですか？"
    );
    if (!confirmed) return;

    // Ask admin for fromYear (default: previous calendar year)
    const defaultFrom = new Date().getFullYear() - 1;
    const raw = prompt(
      `移行元の年を入力してください（例: ${defaultFrom}）。そのままOKすると ${defaultFrom} が使われます。`,
      String(defaultFrom)
    );
    const fromYear = raw ? Number(raw) : defaultFrom;
    if (!fromYear || Number.isNaN(fromYear))
      return alert("有効な年を入力してください。");

    try {
      setMigrating(true);
      const res = await migrateRemainingToNextYear({
        studentId: student.id,
        fromYear,
        toYear: fromYear + 1,
      });

      if (res && res.migrated) {
        alert(
          `移行が完了しました。${res.addedAmount} 円を ${res.toYear} 年へ追加しました。`
        );
        // reload to reflect updated schedules
        window.location.reload();
      } else {
        alert(`移行は行われませんでした: ${res?.reason || "未払い残高なし"}`);
      }
    } catch (err) {
      console.error("migrateYear failed:", err);
      alert("移行に失敗しました。コンソールを確認してください。");
    } finally {
      setMigrating(false);
    }
  };

  const handleReceiptUpload = async (targetMonth) => {
    if (!file || !student) return alert("ファイルを選択してください。");
    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return alert("有効な金額を入力してください（例: 80000）");
    }
    setUploading(true);
    setUploadProgress(0);

    // Helper: convert File/Blob to base64 data URL
    const toBase64 = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(f);
      });

    try {
      // convert file to base64 (keeps compatibility with existing UI that
      // displays receipts using data URLs)
      const base64Data = await toBase64(file);

      const paymentsRef = collection(db, "payments");
      const monthValue =
        targetMonth ||
        student.startMonth ||
        new Date().toISOString().slice(0, 7);

      const paymentPayload = {
        studentId: student.studentId,
        course: student.courseId || "未設定",
        receiptBase64: base64Data,
        amount: numericAmount,
        paymentMethod: "銀行振込",
        status: "支払い済み",
        createdAt: serverTimestamp(),
        uploadedAt: serverTimestamp(),
        verified: false,
        month: monthValue,
      };

      const paymentDocRef = await addDoc(paymentsRef, paymentPayload);
      // add paymentId field for easier querying later
      await updateDoc(doc(db, "payments", paymentDocRef.id), {
        paymentId: paymentDocRef.id,
      });

      // optimistic local update so UI updates immediately without realtime
      const localCopy = {
        id: paymentDocRef.id,
        paymentId: paymentDocRef.id,
        ...paymentPayload,
        createdAt: new Date(),
        uploadedAt: new Date(),
      };
      setPayments((prev) => [localCopy, ...(prev || [])]);

      alert("支払い情報を保存しました！");
      setFile(null);
      setAmount("");
      setUploadProgress(0);
    } catch (err) {
      console.error("アップロードエラー:", err);
      alert("アップロードに失敗しました。コンソールを確認してください。");
    } finally {
      setUploading(false);
    }
  };

  // delete a payment (one-shot) with optimistic UI update
  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    const ok = confirm("この支払い履歴を削除してもよろしいですか？");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "payments", paymentId));
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      console.error("支払い削除に失敗しました:", err);
      alert("削除に失敗しました。コンソールを確認してください。");
    }
  };

  const openLightbox = (src) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load student by routeId (if present), otherwise fall back to session user
  useEffect(() => {
    let mounted = true;
    const loadStudent = async () => {
      setLoading(true);
      try {
        const idToUse =
          routeId ||
          session?.user?.studentId ||
          String(session?.user?.email || "").split("@")[0];
        if (!idToUse) {
          if (mounted) setStudent(null);
          return;
        }

        // try doc by id first
        try {
          const sref = doc(db, "students", String(idToUse));
          const snap = await getDoc(sref);
          if (!mounted) return;
          if (snap.exists()) {
            setStudent({ id: snap.id, ...snap.data() });
          } else {
            // fallback: query by studentId field
            const q = query(
              collection(db, "students"),
              where("studentId", "==", String(idToUse)),
              limit(1)
            );
            const snapshot = await getDocs(q);
            if (!mounted) return;
            if (!snapshot.empty) {
              const d = snapshot.docs[0];
              setStudent({ id: d.id, ...d.data() });
            } else {
              setStudent(null);
            }
          }
        } catch (err) {
          console.error("student load error:", err);
          if (mounted) setStudent(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadStudent();
    return () => {
      mounted = false;
    };
  }, [status, session, routeId]);

  // 🔹 コース情報を取得（per-id ページでも学費を表示するため）
  // stable dependency combining courseId and totalFees to avoid extra reruns
  const _courseKeyAndFees = `${student?.courseId ?? ""}::${String(
    student?.totalFees ?? ""
  )}`;

  useEffect(() => {
    const fetchCourse = async () => {
      if (!student?.courseId) {
        setCourseInfo(null);
        setComputedTuition(null);
        return;
      }

      // local student year derivation (minimal, same logic as main page)
      let displayStudentYearLocal = null;
      if (student?.studentId) {
        const sid = String(student.studentId);
        if (sid.length >= 3) {
          const cohortDigits = sid.slice(1, 3);
          if (!Number.isNaN(Number(cohortDigits))) {
            const cohortFull = 2000 + Number(cohortDigits);
            const nowYear = new Date().getFullYear();
            displayStudentYearLocal = nowYear - cohortFull + 1;
            if (displayStudentYearLocal < 1) displayStudentYearLocal = 1;
          }
        }
      }

      const makeOrdinalLocal = (n) => {
        if (!Number.isFinite(n)) return `${n}`;
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

      const studentYearJP =
        student?.year ||
        student?.gradeJP ||
        (displayStudentYearLocal ? `${displayStudentYearLocal}年生` : null);
      const studentYearEN =
        student?.grade ||
        (displayStudentYearLocal
          ? `${makeOrdinalLocal(displayStudentYearLocal)} Year`
          : null);

      try {
        // try exact match by year+courseKey first
        let qsnap = null;
        if (studentYearEN) {
          const qpref = query(
            collection(db, "courses"),
            where("courseKey", "==", student.courseId),
            where("year", "==", studentYearEN),
            limit(1)
          );
          qsnap = await getDocs(qpref);
        }

        if ((!qsnap || qsnap.empty) && studentYearJP) {
          const qpref2 = query(
            collection(db, "courses"),
            where("courseKey", "==", student.courseId),
            where("year", "==", studentYearJP),
            limit(1)
          );
          qsnap = await getDocs(qpref2);
        }

        if (!qsnap || qsnap.empty) {
          const q = query(
            collection(db, "courses"),
            where("courseKey", "==", student.courseId),
            limit(1)
          );
          qsnap = await getDocs(q);
        }

        if (qsnap && !qsnap.empty) {
          const docSnap = qsnap.docs[0];
          const d = docSnap.data();
          const monthly = Number(d.pricePerMonth) || null;
          const totalFee = Number(d.fee) || Number(d.tuition) || null;
          const displayTotal = totalFee ?? monthly ?? 0;
          setCourseInfo({
            id: docSnap.id,
            name: d.name || "未設定",
            pricePerMonth: monthly,
            totalFee: totalFee,
            monthlyTemplate: d.monthlyTemplate || {},
          });
          setComputedTuition(displayTotal);
        } else {
          // fallback: use student.totalFees if present
          const fallback = Number(student?.totalFees) || 0;
          setCourseInfo(null);
          setComputedTuition(fallback || null);
        }
      } catch (err) {
        console.error("コース取得エラー (per-id):", err);
        setCourseInfo(null);
        setComputedTuition(null);
      }
    };

    fetchCourse();
  }, [
    _courseKeyAndFees,
    student?.courseId,
    student?.totalFees,
    student?.studentId,
    student?.grade,
    student?.gradeJP,
    student?.year,
  ]);

  // Fetch payments once (single-shot)
  useEffect(() => {
    if (!student?.studentId) return;
    let mounted = true;
    (async () => {
      try {
        const paymentsRef = collection(db, "payments");
        const q = query(
          paymentsRef,
          where("studentId", "==", student.studentId),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if (!mounted) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPayments(data);
      } catch (err) {
        console.error("Payments getDocs error:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [student?.studentId]);

  // The rest of the rendering logic mirrors the main dashboard component.
  if (status === "loading" || loading) {
    return (
      <div className={styles.center}>
        <h3>読み込み中です...</h3>
      </div>
    );
  }

  if (status === "unauthenticated" && !routeId) {
    return (
      <div className={styles.center}>
        <h2>サインインしてください</h2>
        <button className={styles.primaryBtn} onClick={() => signIn()}>
          サインイン
        </button>
      </div>
    );
  }

  const baseTotal = Number(
    courseInfo?.totalFee ??
      courseInfo?.pricePerMonth ??
      computedTuition ??
      courseTuition ??
      student?.totalFees ??
      0
  );
  const appliedDiscount = Number(student?.discount ?? discount) || 0;
  const total = Math.max(baseTotal - appliedDiscount, 0);
  const paidFromPayments = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const paid = paidFromPayments || Number(student?.paidAmount || 0);
  const remaining = Math.max(total - paid, 0);
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

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

  const makeOrdinal = (n) => {
    if (!Number.isFinite(n)) return `${n}`;
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

  const studentYearJP =
    student?.year ||
    student?.gradeJP ||
    (displayStudentYear ? `${displayStudentYear}年生` : null);
  const studentYearEN =
    student?.grade ||
    (displayStudentYear ? `${makeOrdinal(displayStudentYear)} Year` : null);

  const rawCourseName =
    courseInfo?.name ??
    student?.courseId ??
    session?.user?.courseName ??
    "未設定";
  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(
    String(rawCourseName)
  );
  let courseDisplayName = rawCourseName;
  if (hasJapanese) {
    if (studentYearJP) courseDisplayName = `${rawCourseName} ${studentYearJP}`;
  } else {
    if (studentYearEN) courseDisplayName = `${rawCourseName} ${studentYearEN}`;
  }

  // helper to format Firestore timestamps or Date-like values
  const formatTimestamp = (t) => {
    if (!t) return "";
    try {
      const d =
        t && typeof t.toDate === "function"
          ? t.toDate()
          : t.seconds
          ? new Date(t.seconds * 1000)
          : new Date(t);
      return d.toLocaleString("ja-JP");
    } catch (e) {
      return String(t);
    }
  };

  return (
    <main className={styles.container}>
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
          毎月の支払い
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "upload" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("upload")}
        >
          レシートをアップロード
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
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況</h1>
          <div className={styles.infoBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "block", marginBottom: 8 }}>
                {/* <strong style={{ fontSize: 14, color: "#0f172a" }}>
                  コース:
                </strong> */}
                <span
                  style={{
                    display: "inline-block",
                    marginLeft: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#0b1220",
                  }}
                >
                  {courseDisplayName}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  marginBottom: 12,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  {session?.user &&
                  (session.user.isAdmin || session.user.role === "teacher") ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "#ffffff",
                        padding: "8px",
                        borderRadius: 10,
                        border: "1px solid #e6e332",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ color: "#374151", fontWeight: 600 }}>
                          割引理由
                        </div>
                        <input
                          type="text"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="例: 奨学金・成績優秀など"
                          style={{
                            width: 240,
                            padding: "8px 10px",
                            height: 36,
                            borderRadius: 8,
                            border: "1px solid #e6eef8",
                            background: "#fff",
                            color: "#0b1220",
                          }}
                        />
                      </label>
                      {discountError && (
                        <div style={{ color: "#ef4444", marginTop: 8 }}>
                          {discountError}
                        </div>
                      )}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ color: "#374151", fontWeight: 600 }}>
                          減免
                        </div>
                        <input
                          type="number"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          placeholder="例: 5000"
                          style={{
                            width: 110,
                            padding: "8px 10px",
                            height: 36,
                            borderRadius: 8,
                            border: "1px solid #e6eef8",
                            background: "#fff",
                            color: "#0b1220",
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#374151" }}>
                      割引: {appliedDiscount.toLocaleString()}円
                      {student?.discountReason ? (
                        <span
                          style={{
                            marginLeft: 12,
                            color: "#0b1220",
                            fontSize: 13,
                          }}
                        >
                          割引理由:{" "}
                          <strong style={{ marginLeft: 6 }}>
                            {student.discountReason}
                          </strong>
                          {student.discountReasonBy ? (
                            <span style={{ marginLeft: 8, color: "#555" }}>
                              担当: {student.discountReasonBy}
                            </span>
                          ) : null}
                          {student.discountReasonAt ? (
                            <span
                              style={{
                                marginLeft: 8,
                                color: "#666",
                                fontSize: 12,
                              }}
                            >
                              日時: {formatTimestamp(student.discountReasonAt)}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className={styles.primaryBtn}
                    onClick={saveDiscount}
                    type="button"
                    style={{
                      padding: "8px 12px",
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      boxShadow: "0 2px 6px rgba(37,99,235,0.12)",
                    }}
                  >
                    保存
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    onClick={handleMigrateYear}
                    type="button"
                    disabled={migrating}
                    title="未払い残を次年度へ移行します"
                    style={{ marginLeft: 8 }}
                  >
                    {migrating ? "移行中..." : "年度移行（未払いを次年へ移す）"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live discount reason message shown above the progress bar */}
          {(discountReason || student?.discountReason) && (
            <div
              style={{
                marginBottom: 8,
                padding: "8px 12px",
                background: "#eef2ff",
                borderRadius: 8,
                color: "#0f172a",
                fontSize: 13,
                display: "block",
                alignItems: "center",
                borderLeft: "4px solid #22c55e",
              }}
            >
              <strong style={{ color: "#0f172a" }}>割引理由:</strong>
              <span
                style={{ marginLeft: 8, color: "#334155", fontWeight: 500 }}
              >
                {discountReason || student?.discountReason}
              </span>
              {student?.discountReasonBy || session?.user ? (
                <span
                  style={{ marginLeft: 12, color: "#475569", fontSize: 12 }}
                >
                  {student?.discountReasonBy
                    ? `担当: ${student.discountReasonBy}`
                    : session?.user?.name || session?.user?.email}
                  {student?.discountReasonAt
                    ? ` ・ ${formatTimestamp(student.discountReasonAt)}`
                    : ""}
                </span>
              ) : null}
            </div>
          )}

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

          <table className={styles.paymentTable}>
            <tbody>
              {payments.map((p) => {
                const date = p.createdAt?.toDate
                  ? p.createdAt.toDate()
                  : new Date();
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
                      <div style={{ marginTop: 8 }}>
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 8,
                          }}
                        >
                          {p.receiptBase64 ? (
                            <Image
                              src={p.receiptBase64}
                              alt={`receipt-${p.id || "img"}`}
                              className={receiptStyles.thumb}
                              onClick={() => openLightbox(p.receiptBase64)}
                              width={80}
                              height={80}
                              unoptimized
                            />
                          ) : p.receiptUrl ? (
                            <Image
                              src={p.receiptUrl}
                              alt={`receipt-${p.id || "img"}`}
                              className={receiptStyles.thumb}
                              onClick={() => openLightbox(p.receiptUrl)}
                              width={80}
                              height={80}
                              unoptimized
                            />
                          ) : (
                            <div className={receiptStyles.placeholder}>
                              <span className={receiptStyles.placeholderText}>
                                No image
                              </span>
                            </div>
                          )}

                          <button
                            className={styles.secondaryBtn}
                            onClick={() => handleDeletePayment(p.id)}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {lightboxSrc && (
            <div
              className={receiptStyles.modal}
              onClick={() => setLightboxSrc(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className={receiptStyles.modalContent}
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={lightboxSrc}
                  alt="receipt-large"
                  className={receiptStyles.modalImage}
                  width={800}
                  height={600}
                  unoptimized
                  style={{ maxWidth: "100%", height: "auto" }}
                />
                <button
                  onClick={() => setLightboxSrc(null)}
                  aria-label="Close"
                  style={{ marginTop: 8 }}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className={styles.card}>
          <PaymentSchedule
            student={student}
            courseInfo={courseInfo}
            payments={payments}
          />
        </section>
      )}

      {activeTab === "upload" && (
        <section className={styles.card}>
          <h2>レシートをアップロード</h2>

          <section
            style={{
              background: "#fff",
              padding: 30,
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              margin: "20px auto",
              width: "100%",
              maxWidth: 600,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 25 }}>
              {/* 月額 */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label
                  style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
                >
                  月額
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="例: 86000"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    width: "100%",
                    background: "#fafafa",
                  }}
                />
              </div>

              {/* 対象月 */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label
                  style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
                >
                  対象月
                </label>
                <input
                  type="month"
                  value={receiptMonth}
                  onChange={(e) => setReceiptMonth(e.target.value)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    width: "100%",
                    background: "#fafafa",
                  }}
                />
              </div>

              {/* ファイル */}
              <div style={{ textAlign: "left", width: "100%" }}>
                <label
                  style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
                >
                  ファイル
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files && e.target.files[0])}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    width: "100%",
                    background: "#fafafa",
                  }}
                />
              </div>

              {/* Centered Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 10,
                }}
              >
                <button
                  onClick={() => handleReceiptUpload(receiptMonth || undefined)}
                  disabled={uploading}
                  style={{
                    padding: "12px 0",
                    width: "50%",
                    maxWidth: 250,
                    background: "#0070F3",
                    color: "#fff",
                    fontWeight: 700,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {uploading ? "アップロード中..." : "OK"}
                </button>
              </div>

              {uploading && (
                <div
                  style={{ textAlign: "center", marginTop: 6, color: "#666" }}
                >
                  進捗: {uploadProgress}%
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2 style={{ textAlign: "center" }}>プロフィール</h2>
          <div
            style={{
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "6px 0" }}>
              名前: {student?.name || session?.user?.name}
            </p>
            <p style={{ margin: "6px 0" }}>メール: {session?.user?.email}</p>
            <p style={{ margin: "6px 0" }}>
              学籍番号: {student?.studentId || "未登録"}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
