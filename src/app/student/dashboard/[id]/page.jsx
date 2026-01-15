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
  onSnapshot,
} from "firebase/firestore";
import styles from "./page.module.css";
import receiptStyles from "@/components/ReceiptList.module.css";
import PaymentSchedule from "@/components/PaymentSchedule";
import migrateRemainingToNextYear from "@/lib/migrateYearTuition";
import { getAcademicYear } from "@/lib/academicYear";
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
  const [prevYearRemaining, setPrevYearRemaining] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const params = useParams();
  const routeId = params?.id;
  const [migrating, setMigrating] = useState(false);

  // New discount system states
  const [discounts, setDiscounts] = useState([]); // realtime list of discount docs
  const [newReason, setNewReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Modal edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDiscountId, setEditDiscountId] = useState(null);

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

  // Discounts: add, edit, delete (saved under students/{studentId}/discounts/{autoId})
  useEffect(() => {
    if (!student?.id) return;
    const discountsRef = collection(
      db,
      "students",
      String(student.id),
      "discounts"
    );
    const q = query(discountsRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDiscounts(arr);
      },
      (err) => {
        console.error("discounts onSnapshot error:", err);
      }
    );
    return () => unsub();
  }, [student?.id]);

  // Allow digits in reason; only validate non-empty string
  const validateReason = (str) => {
    if (!str) return false;
    return String(str).trim().length > 0;
  };

  const handleAddDiscount = async () => {
    if (!student?.id) return alert("学生情報が見つかりません。");
    if (!session?.user) return alert("権限がありません。");

    const reason = String(newReason || "").trim();
    const amountNum = Number(newAmount);

    if (!reason) return alert("割引理由を入力してください。");
    if (!validateReason(reason)) return alert("割引理由を入力してください。");

    if (Number.isNaN(amountNum) || !isFinite(amountNum))
      return alert("割引額は数値で入力してください。");
    if (amountNum < 0 || amountNum > 999999)
      return alert("割引額は 0 〜 999,999 の範囲で入力してください。");

    if ((discounts || []).length >= 5)
      return alert(
        "割引レコードは最大5件までです。既存の割引を削除してください。"
      );

    try {
      const ref = collection(db, "students", String(student.id), "discounts");
      const payload = {
        reason,
        amount: amountNum,
        teacher: session.user.email || session.user.name || null,
        createdAt: serverTimestamp(),
      };
      await addDoc(ref, payload);
      // clear inputs - onSnapshot will update discounts list
      setNewReason("");
      setNewAmount("");
    } catch (err) {
      console.error("add discount failed:", err);
      alert("割引の保存に失敗しました。コンソールを確認してください。");
    }
  };

  const handleDeleteDiscount = async (id) => {
    if (!student?.id || !id) return;
    const ok = confirm("この割引を削除してよろしいですか？");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "students", String(student.id), "discounts", id));
    } catch (err) {
      console.error("delete discount failed:", err);
      alert("削除に失敗しました。コンソールを確認してください。");
    }
  };

  // Replace prompt-based edit with modal:
  const openEditModal = (discount) => {
    if (!discount || !discount.id) return;
    setEditDiscountId(discount.id);
    setEditReason(discount.reason || "");
    setEditAmount(String(discount.amount ?? ""));
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditReason("");
    setEditAmount("");
    setEditDiscountId(null);
  };

  const applyEditDiscount = async () => {
    if (!student?.id || !editDiscountId)
      return alert("学生情報または割引IDが見つかりません。");
    const reason = String(editReason || "").trim();
    const amountNum = Number(editAmount);

    if (!reason) return alert("割引理由を入力してください。");
    if (!validateReason(reason)) return alert("割引理由を入力してください。");
    if (Number.isNaN(amountNum) || !isFinite(amountNum))
      return alert("割引額は数値で入力してください。");
    if (amountNum < 0 || amountNum > 999999)
      return alert("割引額は 0 〜 999,999 の範囲で入力してください。");

    try {
      await updateDoc(
        doc(db, "students", String(student.id), "discounts", editDiscountId),
        {
          reason,
          amount: amountNum,
          updatedAt: serverTimestamp(),
        }
      );
      closeEditModal();
    } catch (err) {
      console.error("apply edit discount failed:", err);
      alert("更新に失敗しました。コンソールを確認してください。");
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
      if (student?.courseId == null) {
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
            const today = new Date();
            const academicYear = getAcademicYear(today);
            displayStudentYearLocal = academicYear - cohortFull + 1;
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

  // Compute previous academic year's remaining amount (academic year starts in April)
  useEffect(() => {
    if (!student?.id) return;

    let mounted = true;

    (async () => {
      try {
        const today = new Date();
        const academicYear = getAcademicYear(today);

        // Determine entranceYear from stored student or parse from studentId
        const parsedYearCode = parseInt(
          String(student.studentId || "").slice(1, 3),
          10
        );
        let parsedEntranceYear =
          2000 + (Number.isFinite(parsedYearCode) ? parsedYearCode : 0);
        if (parsedEntranceYear > academicYear) parsedEntranceYear -= 100;
        const entranceYear = student.entranceYear || parsedEntranceYear;

        const gradeNum = academicYear - entranceYear + 1;

        // previous academic year to consider (the year that just finished if student promoted)
        const prevAcademicYear = academicYear - 1;

        // only compute for students who may have a previous-year remainder (grade >=2)
        if (gradeNum < 2) {
          if (mounted) setPrevYearRemaining(0);
          return;
        }

        // read paymentSchedules subcollection and sum months for prevAcademicYear
        const schedRef = collection(
          db,
          "students",
          String(student.id),
          "paymentSchedules"
        );
        const snap = await getDocs(schedRef);
        if (!mounted) return;
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const prevDocs = docs.filter(
          (d) =>
            typeof d.month === "string" &&
            d.month.startsWith(`${prevAcademicYear}-`)
        );

        const totalDue = prevDocs.reduce(
          (s, d) => s + (Number(d.dueAmount) || 0),
          0
        );
        const totalPaid = prevDocs.reduce(
          (s, d) => s + (Number(d.paidAmount) || 0),
          0
        );
        const remainingPrev = Math.max(totalDue - totalPaid, 0);

        if (mounted) setPrevYearRemaining(remainingPrev);
      } catch (err) {
        console.error("Failed to compute previous year remaining:", err);
        if (mounted) setPrevYearRemaining(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [student?.id, student?.studentId, student?.entranceYear]);

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
  // original total tuition (source of truth, not displayed directly anymore)
  const originalTotal = Number(
    courseInfo?.totalFee ??
      courseInfo?.pricePerMonth ??
      computedTuition ??
      courseTuition ??
      student?.totalFees ??
      0
  );

  // total discount computed from discount subcollection (real-time)
  const totalDiscount = (discounts || []).reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0
  );

  // reduced total tuition after discounts (this is what we display as 総学費)
  const reducedTotal = Math.max(originalTotal - totalDiscount, 0);

  const paidFromPayments = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const paid = paidFromPayments || Number(student?.paidAmount || 0);

  // remaining = reduced total - paid
  const remainingBase = Math.max(reducedTotal - paid, 0);
  // 合算表示: 前年度残を含める
  const remaining = Math.max(
    (remainingBase || 0) + (prevYearRemaining || 0),
    0
  );

  // progress uses paid / reducedTotal (if reducedTotal is zero, progress = 0)
  const progress =
    reducedTotal > 0 ? Math.min((paid / reducedTotal) * 100, 100) : 0;

  let displayStudentYear = null;
  if (student?.studentId) {
    const sid = String(student.studentId);
    if (sid.length >= 3) {
      const cohortDigits = sid.slice(1, 3);
      if (!Number.isNaN(Number(cohortDigits))) {
        const cohortFull = 2000 + Number(cohortDigits);
        const today = new Date();
        const academicYear = getAcademicYear(today);
        displayStudentYear = academicYear - cohortFull + 1;
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
    session.user.courseName ??
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
            <div className={styles.rowFlexCenterGap12}>
              <div className={styles.blockMb8}>
                <span className={styles.courseNameSpan}>
                  {courseDisplayName}
                </span>
              </div>

              <div className={styles.flexRowMb12CenterGap12}>
                <div className={styles.flex1}>
                  {session?.user &&
                  (session.user.isAdmin || session.user.role === "teacher") ? (
                    <div className={styles.adminBox}>
                      {/* New discount inputs (single-line, responsive) */}
                      <div className={styles.discountRow}>
                        <input
                          type="text"
                          value={newReason}
                          onChange={(e) => setNewReason(e.target.value)}
                          placeholder="減免理由"
                          className={styles.discountInput}
                        />
                        <input
                          type="number"
                          value={newAmount}
                          onChange={(e) => setNewAmount(e.target.value)}
                          placeholder="減免額"
                          min={0}
                          max={999999}
                          className={styles.discountAmount}
                        />
                        <button
                          onClick={handleAddDiscount}
                          type="button"
                          className={styles.discountSave}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#374151" }}>
                      合計減免: {totalDiscount.toLocaleString()}円
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Discount items list (real-time) */}
          <div className={styles.discountSection}>
            <strong>減免履歴</strong>
            <div className={styles.discountListBox}>
              {(!discounts || discounts.length === 0) && (
                <div style={{ color: "#666" }}>減免はありません。</div>
              )}
              {(discounts || []).map((d) => (
                <div key={d.id} className={styles.discountItem}>
                  <div className={styles.discountItemLeft}>
                    <div className={styles.discountReasonBlock}>
                      <div className={styles.discountReasonTitle}>
                        {d.reason}
                      </div>
                      <div className={styles.discountMeta}>
                        {d.teacher || "N/A"}
                        {d.createdAt
                          ? ` ・ ${formatTimestamp(d.createdAt)}`
                          : ""}
                      </div>
                    </div>
                    <div className={styles.discountAmountValue}>
                      ¥{Number(d.amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className={styles.discountItemActions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => openEditModal(d)}
                      title="編集"
                      type="button"
                    >
                      編集
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handleDeleteDiscount(d.id)}
                      title="削除"
                      type="button"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Modal */}
          {isEditModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className={styles.editModalOverlay}
              onClick={closeEditModal}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={styles.editModalContent}
              >
                <h3 style={{ marginTop: 0 }}>減免を編集</h3>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    減免理由
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="例: 奨学金・成績優秀など"
                    className={styles.editInputText}
                  />
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    減免額
                  </label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="例: 5000"
                    min={0}
                    max={999999}
                    className={styles.editInputNumber}
                  />
                  <div className={styles.editActions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={closeEditModal}
                      type="button"
                    >
                      キャンセル
                    </button>
                    <button
                      className={styles.primaryBtn}
                      onClick={applyEditDiscount}
                      type="button"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
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
                {reducedTotal.toLocaleString()}円
              </div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>支払い済み</div>
              <div className={`${styles["stat-value"]} ${styles.paid}`}>
                {paid.toLocaleString()}円
              </div>
            </article>
            {/* <article className={styles.stat}>
              <div className={styles["stat-label"]}>割引合計</div>
              <div className={styles["stat-value"]}>
                {totalDiscount.toLocaleString()}円
              </div>
            </article> */}
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>残り</div>
              <div className={`${styles["stat-value"]} ${styles.remain}`}>
                {remaining.toLocaleString()}円
              </div>
            </article>
            {typeof prevYearRemaining === "number" && prevYearRemaining > 0 && (
              <article className={styles.stat}>
                <div className={styles["stat-label"]}>
                  前年度（
                  {(new Date().getMonth() + 1 >= 4
                    ? new Date().getFullYear()
                    : new Date().getFullYear() - 1) - 1}
                  年度）の残り
                </div>
                <div className={styles["stat-value"]}>
                  {prevYearRemaining.toLocaleString()}円
                </div>
              </article>
            )}
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

          <section className={styles.uploadSection}>
            <div className={styles.uploadForm}>
              {/* 月額 */}
              <div className={styles.uploadField}>
                <label className={styles.uploadLabel}>月額</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="例: 86000"
                  className={styles.uploadInput}
                />
              </div>

              {/* 対象月 */}
              <div className={styles.uploadField}>
                <label className={styles.uploadLabel}>対象月</label>
                <input
                  type="month"
                  value={receiptMonth}
                  onChange={(e) => setReceiptMonth(e.target.value)}
                  className={styles.uploadInput}
                />
              </div>

              {/* ファイル */}
              <div className={styles.uploadField}>
                <label className={styles.uploadLabel}>ファイル</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files && e.target.files[0])}
                  className={styles.uploadFileInput}
                />
              </div>

              {/* Centered Button */}
              <div className={styles.uploadBtnWrap}>
                <button
                  onClick={() => handleReceiptUpload(receiptMonth || undefined)}
                  disabled={uploading}
                  className={styles.uploadBtn}
                >
                  {uploading ? "アップロード中..." : "OK"}
                </button>
              </div>

              {uploading && (
                <div className={styles.uploadProgress}>
                  進捗: {uploadProgress}%
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {activeTab === "profile" && (
        <section className={styles.card}>
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
              名前: {student?.name || session.user.name}
            </p>
            <p style={{ margin: "6px 0" }}>メール: {session.user.email}</p>
            <p style={{ margin: "6px 0" }}>
              学籍番号: {student?.studentId || "未登録"}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
