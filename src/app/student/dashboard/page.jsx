"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { db } from "@/firebase/clientApp";
import StudentAutoRegister from "@/components/StudentAutoRegister";
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
  runTransaction,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/firebase";
import styles from "./page.module.css";
import Image from "next/image";
import receiptStyles from "@/components/ReceiptList.module.css";
import PaymentSchedule from "@/components/PaymentSchedule";
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [amount, setAmount] = useState("");
  const [receiptMonth, setReceiptMonth] = useState("");
  const [payments, setPayments] = useState([]); // 🔹 支払い履歴を保存する配列
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // 📸 レシートアップロード関数（支払い情報を記録）
  const handleReceiptUpload = async (targetMonth) => {
    if (!file || !student) return alert("ファイルを選択してください。");

    // 金額チェック
    const numericAmount = Number(String(amount).replace(/[^0-9.-]/g, ""));
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return alert("有効な金額を入力してください（例: 80000）");
    }
    setUploading(true);
    setUploadProgress(0);

    try {
      // (オプション) クライアント側で画像をリサイズして容量を下げる
      const compressImage = async (
        inputFile,
        maxWidth = 1200,
        quality = 0.8
      ) => {
        try {
          // createImageBitmap は速くてメモリ効率が良い（対応ブラウザで）
          const bitmap = await createImageBitmap(inputFile);
          const scale = Math.min(1, maxWidth / bitmap.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          return await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality)
          );
        } catch (e) {
          // フォールバック: そのまま返す
          return inputFile;
        }
      };

      let uploadFile = file;
      try {
        const compressed = await compressImage(file, 1200, 0.8);
        if (compressed && compressed.size && compressed.size < file.size) {
          // compressed is a Blob; convert to File to keep original name if possible
          uploadFile = new File(
            [compressed],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: compressed.type }
          );
        }
      } catch (e) {
        console.warn("画像圧縮に失敗しました。元のファイルを使用します。", e);
        uploadFile = file;
      }

      // 1️⃣ クライアント側で Base64 に変換して Firestore に保存 (Storage を使わない)
      const toBase64 = (f) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(f);
        });

      // convert uploadFile (File) to base64 data URL
      const base64Data = await toBase64(uploadFile);

      const paymentsRef = collection(db, "payments");
      const monthValue =
        targetMonth ||
        student.startMonth ||
        new Date().toISOString().slice(0, 7); // YYYY-MM

      const paymentPayload = {
        studentId: student.studentId,
        course: student.courseId || "未設定",
        receiptBase64: base64Data,
        amount: numericAmount, // 入力金額
        paymentMethod: "銀行振込",
        status: "支払い済み",
        createdAt: serverTimestamp(),
        uploadedAt: serverTimestamp(),
        verified: false,
        month: monthValue,
      };

      const paymentDocRef = await addDoc(paymentsRef, paymentPayload);

      // 追加入力: paymentId をセット
      await updateDoc(doc(db, "payments", paymentDocRef.id), {
        paymentId: paymentDocRef.id,
      });

      alert("支払い情報を保存しました！");
      setFile(null);
      setAmount("");
      setUploadProgress(0);
    } catch (err) {
      console.error("アップロードエラー:", err);
      alert("アップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  };

  // 支払いレコードを削除するヘルパー
  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    const ok = confirm("この支払い履歴を削除してもよろしいですか？");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "payments", paymentId));
      // オプティミスティックにローカル状態も更新
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      console.error("支払い削除に失敗しました:", err);
      alert("削除に失敗しました。コンソールを確認してください。");
    }
  };

  // ライトボックス（画像拡大）
  const openLightbox = (src) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🔹 ログイン中の学生情報をFirestoreからリアルタイム取得
  <StudentAutoRegister />;
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
    // courseKey を判定して返すユーティリティ
    // シンプルなプレフィックス判定: 最初の文字に基づき courseId を返す
    // 要件:
    // - studentId が "j" で始まる → "japanese"
    // - studentId が "k" で始まる → "tourism-japanese"
    // - studentId が "i" で始まる → "it"
    // - studentId が "w" で始まる → "web"
    // - 上記に該当しない場合 → "unknown"
    const determineCourseKey = async (studentId, email) => {
      const id = String(studentId || "")
        .toLowerCase()
        .trim();
      // --- ① もしコース名や日本語名が入力されている場合に対応 ---
      const name = id
        .replace(/\s+/g, "")
        .replace("コース", "")
        .replace("科", ""); // 「コース」「科」を削除して判定
      const nameMap = {
        japanese: [
          "日本語ビジネス",
          "日本語ビジネスコース",
          "japanese",
          "japanesebusiness",
        ],
        kokusai: [
          "国際ビジネス",
          "国際ビジネスコース",
          "international",
          "business",
        ],
        it: ["情報技術", "it", "itコース"],
        web: ["web", "ウェブ", "ウェブプログラミング", "webプログラミング"],
        global: ["グローバル", "global"],
      };
      // ① 日本語 or 英語名ベースでマッチするかチェック
      for (const [key, values] of Object.entries(nameMap)) {
        if (values.some((v) => name.includes(v))) return key;
      }
      // ② Firestore の courses からもチェック（name が日本語のみ登録されている場合）
      try {
        const q = query(collection(db, "courses"));
        const qsnap = await getDocs(q);
        for (const docSnap of qsnap.docs) {
          const d = docSnap.data();
          const courseName = (d.name || "").replace(/\s+/g, "");
          if (
            courseName &&
            name.includes(courseName.replace("コース", "").replace("科", ""))
          ) {
            return (
              d.courseKey ||
              (d.nameEn?.toLowerCase().replace(/\s+/g, "") ?? "unknown")
            );
          }
        }
      } catch (err) {
        console.warn("Firestore からの courseKey 判定エラー:", err);
      }

      // switch (name) {
      //   // 日本語ビジネスコース or Japanese Business
      //   case "japanesebusiness":
      //   case "日本語ビジネス":
      //   case "日本語ビジネスコース":
      //     return "japanese";
      //   default:
      //     break;
      // }
      // // 日本語・英語名をチェック
      // for (const [key, values] of Object.entries(nameMap)) {
      //   if (values.some((v) => name.includes(v))) return key;
      // }

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
        default:
          return "unknown";
      }
    };

    // Save student and automatically determine + set courseId (courseKey).
    // This helper will try heuristics first, then fall back to scanning available
    // courses if needed so new courses don't require manual changes.
    const saveStudentWithAutoCourse = async (studentId, email, extra = {}) => {
      const courseKey = await determineCourseKey(studentId, email);
      const studentRef = doc(db, "students", studentId);
      const snap = await getDoc(studentRef);

      if (!snap.exists()) {
        // compute entrance year and grade labels (EN/JP) based on studentId
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

        // merge payload with any extra fields passed in
        const payload = {
          studentId,
          email,
          name: session.user?.name || "未設定",
          nameKana: "",
          courseId: courseKey, // students stores courseKey now
          courseKey,
          startMonth: new Date().toISOString().slice(0, 7),
          entranceYear,
          grade: gradeEN,
          gradeJP,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...extra,
        };

        // We'll perform the student create + course increment inside a transaction
        // to avoid race conditions where two parallel registrations cause
        // double-increment.
        // First resolve the best-matching courseDocId (if any)
        let resolvedCourseDocId = null;
        if (courseKey && courseKey !== "unknown") {
          try {
            let qsnap = null;
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

            if (qsnap && !qsnap.empty) {
              resolvedCourseDocId = qsnap.docs[0].id;
            }
          } catch (err) {
            console.warn("Failed to resolve course doc for increment:", err);
          }
        }

        try {
          await runTransaction(db, async (transaction) => {
            const sSnap = await transaction.get(studentRef);
            if (sSnap.exists()) return; // someone created it concurrently

            // include courseDocId in payload for future moves
            const payloadWithDoc = {
              ...payload,
              courseDocId: resolvedCourseDocId,
            };
            transaction.set(studentRef, payloadWithDoc);

            if (resolvedCourseDocId) {
              const courseDocRef = doc(db, "courses", resolvedCourseDocId);
              transaction.update(courseDocRef, {
                students: increment(1),
                updatedAt: serverTimestamp(),
              });
            }
          });
        } catch (err) {
          console.warn(
            "Transaction failed for student create + increment:",
            err
          );
        }

        console.log(
          "✅ 新しい学生を登録しました:",
          studentId,
          "courseKey:",
          courseKey,
          "grade:",
          gradeEN
        );
      }
    };

    const registerStudentIfNeeded = async () => {
      if (!session?.user?.email) return;
      const email = session.user.email;
      const studentId = email.split("@")[0];
      await saveStudentWithAutoCourse(studentId, email);
    };

    if (status === "authenticated") {
      registerStudentIfNeeded();
    }
  }, [status, session]);

  // 🔹 コース情報を取得
  // Combine courseId and totalFees into a single stable dependency so the
  // dependency array length never changes between renders (avoids HMR warning).
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
      // ローカルで student の学年表記 (EN/JP) を算出
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
        // 1️⃣ まずは courseKey と学年が一致するコースを優先的に検索する
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

        // それでも見つからなければ courseKey のみでフォールバック
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

          // 2️⃣ 金額の取得: コース側に total (fee) があれば優先、無ければ monthly を使う
          const monthly = Number(d.pricePerMonth) || null;
          const totalFee = Number(d.fee) || Number(d.tuition) || null;
          const displayTotal = totalFee ?? monthly ?? 0;

          // 3️⃣ コース情報を保存（総額と月額を両方保持）
          setCourseInfo({
            id: docSnap.id,
            name: d.name || "未設定",
            pricePerMonth: monthly,
            totalFee: totalFee,
          });
          setComputedTuition(displayTotal);
        } else {
          // フォールバック検索: courseKey のプレフィックスやコース名で探す
          let found = false;

          // まず courseKey の範囲検索
          try {
            const q2 = query(
              collection(db, "courses"),
              where("courseKey", ">=", student.courseId),
              where("courseKey", "<=", student.courseId + "\uf8ff"),
              limit(1)
            );
            const qsnap2 = await getDocs(q2);
            if (!qsnap2.empty) {
              const docSnap = qsnap2.docs[0];
              const d = docSnap.data();
              const monthly = Number(d.pricePerMonth) || null;
              const totalFee = Number(d.fee) || Number(d.tuition) || null;
              const displayTotal = totalFee ?? monthly ?? 0;
              setCourseInfo({
                id: docSnap.id,
                name: d.name || "未設定",
                pricePerMonth: monthly,
                totalFee: totalFee,
              });
              setComputedTuition(displayTotal);
              found = true;
            }
          } catch (err) {
            console.warn("courseKey プレフィックス検索でエラー:", err);
          }

          // 次にコース名の候補で検索（簡易マッピング）
          if (!found) {
            const nameMap = {
              japanese: ["日本語ビジネスコース", "日本語科", "日本語コース"],
              "tourism-japanese": [
                "観光日本語コース",
                "観光コース",
                "観光日本語",
              ],
              web: ["WEBプログラミング", "ウェブプログラミング"],
              it: ["ITコース", "情報技術コース"],
            };

            const candidates = nameMap[student.courseId] || [];
            for (const name of candidates) {
              try {
                const q3 = query(
                  collection(db, "courses"),
                  where("name", "==", name),
                  limit(1)
                );
                const snap3 = await getDocs(q3);
                if (!snap3.empty) {
                  const docSnap = snap3.docs[0];
                  const d = docSnap.data();
                  const monthly = Number(d.pricePerMonth) || null;
                  const totalFee = Number(d.fee) || Number(d.tuition) || null;
                  const displayTotal = totalFee ?? monthly ?? 0;
                  setCourseInfo({
                    id: docSnap.id,
                    name: d.name || "未設定",
                    pricePerMonth: monthly,
                    totalFee: totalFee,
                  });
                  setComputedTuition(displayTotal);
                  found = true;
                  break;
                }
              } catch (err) {
                console.warn("コース名検索でエラー:", err);
              }
            }
          }

          if (!found) {
            console.warn("コースが見つかりません:", student.courseId);
            // 最後のフォールバック: students ドキュメントに既に totalFees があればそれを使う
            const fallback = Number(student?.totalFees) || 0;
            setCourseInfo(null);
            setComputedTuition(fallback || null);
          }
        }
      } catch (err) {
        console.error("コース取得エラー:", err);
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
          console.warn(
            "Firestore index required or query failed:",
            err.message
          );
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
          console.warn(
            "Firestore index required or query failed:",
            err.message
          );
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
  {
    uploading && <div style={{ marginTop: 6 }}>進捗: {uploadProgress}%</div>;
  }
  // total: prefer courseInfo.pricePerMonth, then computedTuition, courseTuition, student.totalFees
  const total = Number(
    courseInfo?.totalFee ??
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

  // コース名に学年を付与して表示するための整形
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

  // 学年ラベルの優先順位: student.year -> student.gradeJP -> student.grade -> computed displayStudentYear
  const studentYearJP =
    student?.year ||
    student?.gradeJP ||
    (displayStudentYear ? `${displayStudentYear}年生` : null);
  const studentYearEN =
    student?.grade ||
    (displayStudentYear ? `${makeOrdinal(displayStudentYear)} Year` : null);

  // コース名表示: 日本語名が含まれる場合は日本語学年を使い、英語名なら英語学年を使う
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

      {/* 🔹 概要タブ */}
      {activeTab === "overview" && (
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況</h1>

          <div className={styles.infoBox}>
            <div>コース: {courseDisplayName}</div>
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
          <table className={styles.paymentTable}>
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
                            <img
                              src={p.receiptBase64}
                              alt={`receipt-${p.id || "img"}`}
                              className={receiptStyles.thumb}
                              onClick={() => openLightbox(p.receiptBase64)}
                            />
                          ) : p.receiptUrl ? (
                            <img
                              src={p.receiptUrl}
                              alt={`receipt-${p.id || "img"}`}
                              className={receiptStyles.thumb}
                              onClick={() => openLightbox(p.receiptUrl)}
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
          {/* lightbox modal for clicked image */}
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
                <button
                  className={receiptStyles.closeBtn}
                  onClick={() => setLightboxSrc(null)}
                  aria-label="閉じる"
                >
                  ×
                </button>
                {/* use regular img to support data URLs and external URLs */}
                <img
                  src={lightboxSrc}
                  alt="receipt-large"
                  className={receiptStyles.modalImage}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* 🔹 履歴タブ */}
      {activeTab === "history" && (
        <section className={styles.card}>
          {/* <h2 className={styles.title}>支払い履歴</h2> */}
          <PaymentSchedule
            student={student}
            courseInfo={courseInfo}
            payments={payments}
          />
        </section>
      )}

      {/* 🔹 アップロードタブ */}
      {activeTab === "upload" && (
        <section className={styles.card}>
          <h2>レシートをアップロード</h2>
          <div
            style={{
              marginTop: 4,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label>
                金額:
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="例: 86000"
                  style={{ marginLeft: 8 }}
                />
              </label>

              <label>
                対象月:
                <input
                  type="month"
                  value={receiptMonth}
                  onChange={(e) => setReceiptMonth(e.target.value)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <label>
                ファイル:
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files && e.target.files[0])}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <button
                onClick={() => handleReceiptUpload(receiptMonth || undefined)}
                disabled={uploading}
              >
                {uploading ? "アップロード中..." : "OK"}
              </button>
              {uploading && (
                <div style={{ marginLeft: 8 }}>進捗: {uploadProgress}%</div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 🔹 プロフィールタブ */}
      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2>プロフィール</h2>

          <div
            style={{
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fff",
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
