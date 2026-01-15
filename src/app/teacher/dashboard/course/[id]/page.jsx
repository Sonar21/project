"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
// import {
//   collection,
//   query,
//   where,
//   doc,
//   deleteDoc,
//   onSnapshot,
//   getDoc,
  
// } from "firebase/firestore";
import { runTransaction, doc, collection, getDocs, query, where, deleteDoc,onSnapshot } from "firebase/firestore";

import { db } from "@/firebase/clientApp";
import Link from "next/link";
import "./detail.css";

const DEBUG = false;
const DEBUG_STUDENT_ID = "w24002";

function toSafeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/[^0-9.-]+/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

export default function CourseDetailPage() {
  const { id } = useParams(); // The course ID from URL
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [students, setStudents] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [paymentsDocsMap, setPaymentsDocsMap] = useState({});
  const [studentIdToDocId, setStudentIdToDocId] = useState({});
  const [schedulesMap, setSchedulesMap] = useState({});
  const [courseDocInfo, setCourseDocInfo] = useState(null);

  // Subscribe to students for this course in real time
  useEffect(() => {
    if (!id) return;

    const studentsRef = collection(db, "students");
    const qByCourseId = query(studentsRef, where("courseId", "==", id));
    const qByCourseDocId = query(studentsRef, where("courseDocId", "==", id));

    const handleSnap = (snap1Docs, snap2Docs) => {
      const map = new Map();
      (snap1Docs || []).forEach((d) =>
        map.set(d.id, { id: d.id, ...d.data() })
      );
      (snap2Docs || []).forEach((d) =>
        map.set(d.id, { id: d.id, ...d.data() })
      );
      if (DEBUG)
        console.log("[CourseDetail] handleSnap students count:", map.size);
      const studentsArr = Array.from(map.values());
      setStudents(studentsArr);
      // Build mapping from payment.studentId -> student doc id so payments
      // can be aggregated per student doc reliably.
      const idMap = {};
      studentsArr.forEach((s) => {
        if (s.studentId) idMap[String(s.studentId)] = s.id;
        idMap[s.id] = s.id;
      });
      setStudentIdToDocId(idMap);
    };

    let latestSnap1 = null;
    let latestSnap2 = null;

    const unsub1 = onSnapshot(
      qByCourseId,
      (snap) => {
        latestSnap1 = snap.docs;
        handleSnap(latestSnap1, latestSnap2);
      },
      (err) => console.error("students onSnapshot error (courseId):", err)
    );

    const unsub2 = onSnapshot(
      qByCourseDocId,
      (snap) => {
        latestSnap2 = snap.docs;
        handleSnap(latestSnap1, latestSnap2);
      },
      (err) => console.error("students onSnapshot error (courseDocId):", err)
    );

    return () => {
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, [id]);

  // When students list changes, subscribe to payments for those students in batches using onSnapshot
  useEffect(() => {
    if (!students || students.length === 0) return;

    const paymentsRef = collection(db, "payments");
    // Query payments by known student identifiers (prefer student.studentId, fallback to doc id)
    const ids = students.map((s) => s.studentId || s.id).filter(Boolean);
    if (ids.length === 0) return;

    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize)
      chunks.push(ids.slice(i, i + chunkSize));

    const snapshotsByChunk = new Array(chunks.length).fill(null);
    const unsubs = [];

    const rebuildMapAndDerive = async () => {
      try {
        const map = {};
        const mapDocs = {};
        for (let ci = 0; ci < snapshotsByChunk.length; ci++) {
          const docs = snapshotsByChunk[ci] || [];
          for (const d of docs) {
            const data = d.data();
            const sidRaw = data.studentId || d.id;
            // Map payment.studentId back to the student doc id when possible
            const docId = studentIdToDocId[String(sidRaw)] || String(sidRaw);
            map[docId] = map[docId] || { totalPaid: 0, count: 0 };
            map[docId].totalPaid += toSafeNumber(data.amount || 0);
            map[docId].count += 1;
            mapDocs[docId] = mapDocs[docId] || [];
            mapDocs[docId].push({ id: d.id, data });
          }
        }

        setPaymentsMap(map);
        setPaymentsDocsMap(mapDocs);
        if (DEBUG) console.log("[CourseDetail] setPaymentsMap ->", map);
      } catch (err) {
        console.error("Failed to rebuild payments map:", err);
      }
    };

    chunks.forEach((chunk, idx) => {
      const q = query(paymentsRef, where("studentId", "in", chunk));
      const unsub = onSnapshot(
        q,
        (snap) => {
          snapshotsByChunk[idx] = snap.docs;
          if (DEBUG)
            console.log(
              `[CourseDetail] payments chunk ${idx} snapshot, docs:`,
              snap.docs.length,
              "chunk:",
              chunk
            );
          rebuildMapAndDerive();
        },
        (err) => console.error("payments onSnapshot error:", err)
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u && u());
  }, [students, studentIdToDocId]);

  // Subscribe to each student's paymentSchedules so status reflects updates in realtime.
  useEffect(() => {
    if (!students || students.length === 0) return;

    const unsubs = [];
    const initial = {};
    students.forEach((s) => {
      initial[s.id] = { totalDue: 0, totalPaid: 0, count: 0 };
    });
    setSchedulesMap(initial);

    students.forEach((s) => {
      try {
        const schedRef = collection(db, "students", s.id, "paymentSchedules");
        const unsub = onSnapshot(
          schedRef,
          (snap) => {
            try {
              let totalDue = 0;
              let totalPaid = 0;
              const docs = snap.docs || [];
              docs.forEach((d) => {
                const data = d.data() || {};
                const due = toSafeNumber(data.dueAmount);
                const paid = toSafeNumber(data.paidAmount);
                totalDue += due;
                totalPaid += paid;
                if (DEBUG && (isNaN(due) || isNaN(paid)))
                  console.warn(
                    `[CourseDetail] schedules doc ${d.id} has non-numeric values:`,
                    d.data()
                  );
              });
              setSchedulesMap((prev) => ({
                ...prev,
                [s.id]: { totalDue, totalPaid, count: docs.length },
              }));
              if (DEBUG)
                console.log(
                  `[CourseDetail] onSnapshot schedules for student doc ${s.id}: totalDue=${totalDue} totalPaid=${totalPaid} count=${docs.length} (studentId=${s.studentId})`
                );
            } catch (e) {
              console.error("Error processing schedules snapshot for", s.id, e);
            }
          },
          (err) => console.error("schedules onSnapshot error for", s.id, err)
        );
        unsubs.push(unsub);
      } catch (e) {
        console.error("Failed to subscribe to schedules for", s.id, e);
      }
    });

    return () => unsubs.forEach((u) => u && u());
  }, [students]);

  // Fetch course doc info (pricePerMonth / fee) to compute expected monthly amount
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "courses", id));
        if (mounted && snap && snap.exists()) setCourseDocInfo(snap.data());
      } catch (e) {
        console.warn("Failed to fetch course doc info:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Extra debug for single student (no extra reads beyond existing snapshots)
  useEffect(() => {
    if (!students || students.length === 0) return;
    const target = students.find((s) => s.studentId === DEBUG_STUDENT_ID);
    if (!target) return;

    if (DEBUG) {
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] student doc (from students snapshot):`,
        target
      );
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] schedulesMap entry:`,
        schedulesMap[target.id]
      );
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] paymentsMap entry:`,
        paymentsMap[target.id] || paymentsMap[target.studentId]
      );
    }
  }, [students, schedulesMap, paymentsMap]);

  // Precompute paymentRate and other derived values for each student so we can
  // filter by paid/unpaid in the UI.
  const rowsWithRates = students.map((s) => {
    const sched = schedulesMap[s.id] || { totalDue: 0, totalPaid: 0, count: 0 };
    const pm = paymentsMap[s.id] || paymentsMap[s.studentId];

    // Raw sources
    const rawTotalFee =
      s.totalFee != null
        ? s.totalFee
        : s.totalFees != null
        ? s.totalFees
        : sched.totalDue != null
        ? sched.totalDue
        : 0;
    const rawPaidAmount =
      s.paidAmount != null
        ? s.paidAmount
        : s.paid != null
        ? s.paid
        : (pm && pm.totalPaid) != null
        ? pm && pm.totalPaid
        : sched.totalPaid != null
        ? sched.totalPaid
        : 0;

    const totalFeeVal = (() => {
      const n = Number(rawTotalFee);
      return isFinite(n) ? n : toSafeNumber(rawTotalFee);
    })();

    const paidVal = (() => {
      const n = Number(rawPaidAmount);
      return isFinite(n) ? n : toSafeNumber(rawPaidAmount);
    })();

    // Month-range based expected total (choice A): startMonth -> current month
    const startMonthStr =
      s.startMonth || s.start_month || new Date().toISOString().slice(0, 7);
    const now = new Date();
    const endMonthStr = now.toISOString().slice(0, 7);

    const monthsBetweenInclusive = (start, end) => {
      try {
        const [sy, sm] = String(start)
          .split("-")
          .map((v) => Number(v));
        const [ey, em] = String(end)
          .split("-")
          .map((v) => Number(v));
        if (!Number.isFinite(sy) || !Number.isFinite(ey)) return 1;
        const months = (ey - sy) * 12 + (em - sm) + 1;
        return Math.max(1, months);
      } catch (e) {
        return 1;
      }
    };

    const monthsCount = monthsBetweenInclusive(startMonthStr, endMonthStr);

    // expected per-month: prefer course doc pricePerMonth, then student price, then prorated total
    const expectedPerMonth =
      Number(courseDocInfo?.pricePerMonth) ||
      Number(courseDocInfo?.price) ||
      Number(s.pricePerMonth) ||
      (Number(totalFeeVal) && monthsCount
        ? Number(totalFeeVal) / monthsCount
        : 0) ||
      0;

    const expectedTotal = expectedPerMonth * monthsCount;

    const discountVal = toSafeNumber(s.discount || 0);
    const expectedDiscountedTotal = Math.max(expectedTotal - discountVal, 0);

    let paymentRate = 0;

    if (expectedTotal > 0) {
      const divisor =
        expectedDiscountedTotal > 0 ? expectedDiscountedTotal : expectedTotal;
      const paymentRateRaw = (paidVal / divisor) * 100;
      paymentRate = Number(
        Math.min(100, Math.max(0, paymentRateRaw)).toFixed(1)
      );
    } else {
      // Fallback to legacy total-based calculation when we don't have monthly info
      const fixedBaseIds = ["w24002", "w24011"];
      let adjustedTotalFeeVal = totalFeeVal;
      if (fixedBaseIds.includes(String(s.studentId)))
        adjustedTotalFeeVal = 860000;

      if (adjustedTotalFeeVal > 0) {
        const discountedTotal = Math.max(adjustedTotalFeeVal - discountVal, 0);
        let divisor;
        if (String(s.studentId) === "w24006") {
          const baseForW24006 = 866000;
          const discountedForW24006 = Math.max(baseForW24006 - discountVal, 0);
          divisor =
            discountedForW24006 > 0 ? discountedForW24006 : baseForW24006;
        } else {
          divisor = discountedTotal > 0 ? discountedTotal : adjustedTotalFeeVal;
        }
        const paymentRateRaw = (paidVal / divisor) * 100;
        paymentRate = Number(
          Math.min(100, Math.max(0, paymentRateRaw)).toFixed(1)
        );
      }
    }

    return {
      s,
      sched,
      pm,
      totalFeeVal,
      paidVal,
      monthsCount,
      expectedPerMonth,
      expectedTotal,
      expectedDiscountedTotal,
      paymentRate,
    };
  });

  const displayedRows = rowsWithRates.filter((r) => {
    const s = r.s;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      const match =
        (s.email || "").toLowerCase().includes(q) ||
        (s.studentId || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter === "paid") return r.paymentRate >= 100;
    if (statusFilter === "unpaid") return r.paymentRate < 100;
    return true;
  });

  // const handleDeleteStudent = async (studentId) => {
  //   if (!window.confirm("この学生を削除しますか？")) return;
  //   try {
  //     await deleteDoc(doc(db, "students", studentId));
  //     alert("学生を削除しました。");
  //   } catch (err) {
  //     console.error("削除エラー:", err);
  //     alert("削除に失敗しました。");
  //   }
  // };
 const handleDeleteStudent = async (studentId) => {
  if (!window.confirm("この学生を削除しますか？")) return;
  try {
    // Delete the student document
    await deleteDoc(doc(db, "students", studentId));

    // Recount students for this course (by courseId and courseDocId for safety)
    const studentsRef = collection(db, "students");
    const q1 = query(studentsRef, where("courseId", "==", id));
    const q2 = query(studentsRef, where("courseDocId", "==", id));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    // Use a Set to avoid double-counting students that match both queries
    const uniqueStudentIds = new Set();
    snap1.forEach(doc => uniqueStudentIds.add(doc.id));
    snap2.forEach(doc => uniqueStudentIds.add(doc.id));
    const newCount = uniqueStudentIds.size;

    // Update the course document with the new count
    const courseRef = doc(db, "courses", id);
    await runTransaction(db, async (transaction) => {
      const courseDoc = await transaction.get(courseRef);
      if (!courseDoc.exists()) return;
      transaction.update(courseRef, {
        students: newCount,
      });
    });
    // Optionally, show a success message
    // alert("学生を削除し、学生数を更新しました。");
  } catch (err) {
    console.error("Failed to delete student or update count:", err);
    alert("削除に失敗しました。");
  }
};

  return (
    <div className="course-detail-page">
      <header className="course-header">
        <h2>コース詳細 - {id}</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            className="search-input"
            placeholder="メールまたは学生記番号で検索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* compute counts from rowsWithRates (if available) */}
            {typeof rowsWithRates !== "undefined" &&
              (() => {
                const totalCount = rowsWithRates.length;
                const paidCount = rowsWithRates.filter(
                  (r) => r.paymentRate >= 100
                ).length;
                const unpaidCount = rowsWithRates.filter(
                  (r) => r.paymentRate < 100
                ).length;
                return (
                  <>
                    <button
                      onClick={() => setStatusFilter("all")}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background:
                          statusFilter === "all" ? "#3b82f6" : "#f3f4f6",
                        color: statusFilter === "all" ? "#fff" : "#111",
                        border: "none",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>All</span>
                      <span
                        style={{
                          background: "rgba(0,0,0,0.08)",
                          padding: "2px 6px",
                          borderRadius: 999,
                        }}
                      >
                        {totalCount}
                      </span>
                    </button>
                    <button
                      onClick={() => setStatusFilter("paid")}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background:
                          statusFilter === "paid" ? "#10b981" : "#f3f4f6",
                        color: statusFilter === "paid" ? "#fff" : "#111",
                        border: "none",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>Paid</span>
                      <span
                        style={{
                          background: "rgba(0,0,0,0.08)",
                          padding: "2px 6px",
                          borderRadius: 999,
                        }}
                      >
                        {paidCount}
                      </span>
                    </button>
                    <button
                      onClick={() => setStatusFilter("unpaid")}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background:
                          statusFilter === "unpaid" ? "#ef4444" : "#f3f4f6",
                        color: statusFilter === "unpaid" ? "#fff" : "#111",
                        border: "none",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span>Unpaid</span>
                      <span
                        style={{
                          background: "rgba(0,0,0,0.08)",
                          padding: "2px 6px",
                          borderRadius: 999,
                        }}
                      >
                        {unpaidCount}
                      </span>
                    </button>
                  </>
                );
              })()}
          </div>
        </div>
      </header>

      <table className="students-table">
        <thead>
          <tr>
            <th>学生記番号</th>
            <th>名前</th>
            <th>メール</th>
            <th>開始月</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {displayedRows.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                学生データがありません。
              </td>
            </tr>
          ) : (
            displayedRows.map((r) => {
              const s = r.s;
              const sched = schedulesMap[s.id] || {
                totalDue: 0,
                totalPaid: 0,
                count: 0,
              };
              // paymentsMap keys are payment.studentId; some student docs may not have
              // `studentId` field populated, so fallback to doc id `s.id` when looking up.
              // paymentsMap is aggregated by student doc id (preferred), fallback to studentId
              const pm = paymentsMap[s.id] || paymentsMap[s.studentId];

              // Compute payment percentage using available fields (strict conversion per spec)
              // Determine raw values (prefer student fields, fallback to schedules/payments)
              const rawTotalFee =
                s.totalFee != null
                  ? s.totalFee
                  : s.totalFees != null
                  ? s.totalFees
                  : sched.totalDue != null
                  ? sched.totalDue
                  : 0;
              const rawPaidAmount =
                s.paidAmount != null
                  ? s.paidAmount
                  : s.paid != null
                  ? s.paid
                  : (pm && pm.totalPaid) != null
                  ? pm && pm.totalPaid
                  : sched.totalPaid != null
                  ? sched.totalPaid
                  : 0;

              // Convert strictly with Number(); if Number() gives NaN, fallback to toSafeNumber
              const totalFeeVal = (() => {
                const n = Number(rawTotalFee);
                return isFinite(n) ? n : toSafeNumber(rawTotalFee);
              })();
              // If certain students should use a fixed base (real-time override),
              // apply it here. The UI/user reported that some rows should use
              // 860,000 as the total. Apply for the remaining two studentIds.
              const fixedBaseIds = ["w24002", "w24011"];
              let adjustedTotalFeeVal = totalFeeVal;
              if (fixedBaseIds.includes(String(s.studentId))) {
                adjustedTotalFeeVal = 860000;
              }
              const paidVal = (() => {
                const n = Number(rawPaidAmount);
                return isFinite(n) ? n : toSafeNumber(rawPaidAmount);
              })();

              // If totalFee is 0 or falsy, show 0%; otherwise compute percentage
              // Apply student-level discount when present (so teacher and student
              // views match). Compute with one decimal of precision to avoid
              // mismatches caused by different rounding.
              let paymentRate = 0;
              if (adjustedTotalFeeVal > 0) {
                const discountVal = toSafeNumber(s.discount || 0);
                const discountedTotal = Math.max(
                  adjustedTotalFeeVal - discountVal,
                  0
                );
                // Special-case: if this is student w24006, use 866000 as the base
                // total (then apply discount) to match the requested fixed total.
                let divisor;
                if (String(s.studentId) === "w24006") {
                  const baseForW24006 = 866000;
                  const discountedForW24006 = Math.max(
                    baseForW24006 - discountVal,
                    0
                  );
                  divisor =
                    discountedForW24006 > 0
                      ? discountedForW24006
                      : baseForW24006;
                } else {
                  divisor =
                    discountedTotal > 0 ? discountedTotal : adjustedTotalFeeVal;
                }
                const paymentRateRaw = (paidVal / divisor) * 100;
                // keep one decimal place
                paymentRate = Number(
                  Math.min(100, Math.max(0, paymentRateRaw)).toFixed(1)
                );
              } else {
                paymentRate = 0;
              }

              const label = `${paymentRate.toFixed(1)}% 支払い済み`;

              if (DEBUG)
                console.log(
                  `[CourseDetail] payment calc for ${s.studentId} doc=${s.id}`,
                  {
                    rawTotalFee,
                    rawPaidAmount,
                    totalFeeVal,
                    paidVal,
                    paymentRate,
                  }
                );
              // (baseTotal calculation removed — not used in this view)

              return (
                <tr key={s.id}>
                  <td data-label="学生記番号">
                    <Link
                      href={`/student/dashboard/${s.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.studentId}
                    </Link>
                  </td>
                  <td data-label="名前">
                    <div className="student-row">
                      {/* <div className="avatar">
                        {(
                          (s.displayName || s.name || s.studentId || "")[0] ||
                          "?"
                        ).toUpperCase()}
                      </div> */}
                      <div className="name-meta">
                        <div className="student-name">
                          {s.displayName || s.name || "-"}
                        </div>
                        <div className="student-email">{s.email || "-"}</div>
                        <div className="student-sub">
                          {s.studentId ? (
                            <Link
                              href={`/student/dashboard/${s.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {s.studentId}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="メール">{s.email || "-"}</td>
                  <td data-label="開始月">
                    {s.startMonth || s.start_date || "-"}
                  </td>
                  <td data-label="状態">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        className={`status-badge ${
                          paymentRate >= 100
                            ? "badge-success"
                            : paymentRate > 0
                            ? "badge-partial"
                            : "badge-unset"
                        }`}
                      >
                        {label}
                      </div>
                      <div
                        className="progress-bar-container"
                        style={{ width: "160px" }}
                      >
                        <div
                          className="progress-bar"
                          style={{ width: `${paymentRate}%` }}
                        />
                      </div>
                      {DEBUG && (
                        <div
                          style={{ fontSize: 12, color: "#555", marginTop: 6 }}
                        >
                          <div>
                            <strong>debug:</strong> paid=
                            {Number(paidVal || 0).toLocaleString()} ・ pmPaid=
                            {Number(
                              (pm && pm.totalPaid) || 0
                            ).toLocaleString()}{" "}
                            ・ schedPaid=
                            {Number(sched.totalPaid || 0).toLocaleString()}
                          </div>
                          <div>
                            total={Number(totalFeeVal || 0).toLocaleString()} ・
                            discount={Number(s.discount || 0).toLocaleString()}{" "}
                            ・ divisor=
                            {Number(
                              Math.max(
                                totalFeeVal - toSafeNumber(s.discount || 0),
                                0
                              ) ||
                                totalFeeVal ||
                                0
                            ).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td data-label="操作" className="actions">
                    {/* <Link
                      href={`/teacher/dashboard/course/${id}/student/${s.id}`}
                      className="mr-2"
                    >
                      編集
                    </Link> */}
                    <button
                      onClick={() => handleDeleteStudent(s.id)}
                      className="ml-2 text-red-600"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
