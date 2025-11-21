// "use client";

// import React, { useEffect, useState, useCallback } from "react";
// import ReceiptList from "./ReceiptList";
// import styles from "./PaymentSchedule.module.css";
// import { useSession } from "next-auth/react";
// import {
//   collection,
//   doc,
//   getDocs,
//   setDoc,
//   onSnapshot,
//   updateDoc,
//   serverTimestamp,
//   query,
//   where,
// } from "firebase/firestore";
// import { db } from "@/firebase/clientApp";

// // Props: student (object), courseInfo (object), payments (array)
// export default function PaymentSchedule({
//   student,
//   courseInfo,
//   payments = [],
// }) {
//   const [schedules, setSchedules] = useState([]);
//   const [creating, setCreating] = useState(false);

//   const { data: session } = useSession();
//   const currentRole = session?.user?.role;
//   const canEditAmounts = currentRole === "teacher" || currentRole === "admin";

//   // Guard
//   const studentId = student?.studentId;

//   const determineScheduleYear = (startMonth) => {
//     // Use the current calendar year for schedules (display Feb-Oct of current year)
//     return new Date().getFullYear();
//   };

//   const ensureSchedules = useCallback(
//     async (targetYear) => {
//       if (!studentId) return;
//       setCreating(true);
//       try {
//         const schedulesRef = collection(
//           db,
//           "students",
//           studentId,
//           "paymentSchedules"
//         );
//         const snap = await getDocs(schedulesRef);
//         const existingIds = new Set(snap.docs.map((d) => d.id));

//         // Determine year: allow targetYear override, else compute from student.startMonth
//         let year = targetYear || determineScheduleYear(student?.startMonth);

//         // Determine desired per-month dueAmount
//         const teacherMonthly =
//           courseInfo && Number(courseInfo.pricePerMonth)
//             ? Math.max(0, Math.round(Number(courseInfo.pricePerMonth)))
//             : null;
//         const monthlyTemplate =
//           (courseInfo && courseInfo.monthlyTemplate) || {};

//         // If teacherMonthly is provided, use it for each month; otherwise distribute total across 9 months
//         let base = 0;
//         let remainder = 0;
//         if (!teacherMonthly) {
//           const total = Number(
//             (courseInfo && (courseInfo.totalFee ?? courseInfo.pricePerMonth)) ||
//               student?.totalFees ||
//               0
//           );
//           base = Math.floor(total / 9);
//           remainder = total - base * 9;
//         }

//         // Create or update documents for months Feb (2) -> Oct (10)
//         const createOrUpdatePromises = [];
//         const createdMonths = [];
//         const updatedMonths = [];
//         for (let m = 2; m <= 10; m++) {
//           const monthStr = `${year}-${String(m).padStart(2, "0")}`; // id

//           // last day of month
//           const lastDay = new Date(year, m, 0); // day 0 of next month
//           const dueDate = lastDay.toISOString().slice(0, 10); // YYYY-MM-DD

//           // determine desired dueAmount
//           let desiredDue = 0;
//           const mm = String(m).padStart(2, "0");
//           if (monthlyTemplate && typeof monthlyTemplate[mm] !== "undefined") {
//             desiredDue = Number(monthlyTemplate[mm]) || 0;
//           } else if (teacherMonthly !== null) {
//             desiredDue = teacherMonthly;
//           } else {
//             const extra = remainder > 0 && m - 2 < remainder ? 1 : 0;
//             desiredDue = base + extra;
//           }

//           const docRef = doc(schedulesRef, monthStr);

//           if (!existingIds.has(monthStr)) {
//             const payload = {
//               month: monthStr,
//               dueDate,
//               dueAmount: desiredDue,
//               paidAmount: 0,
//               status: "未払い",
//               createdAt: serverTimestamp(),
//               updatedAt: serverTimestamp(),
//             };
//             createOrUpdatePromises.push(setDoc(docRef, payload));
//             createdMonths.push(monthStr);
//           } else {
//             // existing doc: check if dueAmount differs and update
//             const existingDoc = snap.docs.find((d) => d.id === monthStr);
//             const existingDue = Number(existingDoc?.data()?.dueAmount) || 0;
//             // Update if desiredDue differs and either a monthlyTemplate value
//             // exists for this month (teacher explicitly set it), or there is
//             // no course-level teacherMonthly (we computed distribution).
//             const hasTemplateValue =
//               monthlyTemplate && typeof monthlyTemplate[mm] !== "undefined";
//             if (
//               existingDue !== desiredDue &&
//               (hasTemplateValue || teacherMonthly === null)
//             ) {
//               createOrUpdatePromises.push(
//                 updateDoc(docRef, {
//                   dueAmount: desiredDue,
//                   updatedAt: serverTimestamp(),
//                 })
//               );
//               updatedMonths.push(monthStr);
//             }
//           }
//         }
//         await Promise.all(createOrUpdatePromises);
//         if (createdMonths.length > 0) {
//           console.info(
//             "Created payment schedule months:",
//             createdMonths.join(", ")
//           );
//         } else {
//           console.info("No missing months to create for year", year);
//         }
//         if (updatedMonths.length > 0) {
//           console.info(
//             "Updated existing payment schedule dueAmount for months:",
//             updatedMonths.join(", ")
//           );
//         }
//       } catch (err) {
//         console.warn("Failed to create payment schedules:", err);
//       } finally {
//         setCreating(false);
//       }
//     },
//     [studentId, courseInfo, student?.startMonth, student?.totalFees]
//   );

//   useEffect(() => {
//     if (!studentId) return;

//     // For debugging: print computed schedule year
//     try {
//       console.debug(
//         "determineScheduleYear (current):",
//         determineScheduleYear()
//       );
//     } catch (e) {
//       /* ignore */
//     }

//     // initial ensure using computed year (based on startMonth or current date)
//     ensureSchedules();

//     const schedulesRef = collection(
//       db,
//       "students",
//       studentId,
//       "paymentSchedules"
//     );
//     const q = query(schedulesRef);
//     const unsub = onSnapshot(q, (snap) => {
//       const year = determineScheduleYear();
//       const data = snap.docs
//         .map((d) => ({ id: d.id, ...d.data() }))
//         .filter((item) => {
//           const m = item.month || item.id;
//           if (!m || typeof m !== "string" || m.length < 7) return false;
//           if (!m.startsWith(`${year}-`)) return false;
//           const mm = Number(m.slice(5, 7));
//           return mm >= 2 && mm <= 10;
//         })
//         .sort((a, b) => a.month.localeCompare(b.month));
//       setSchedules(data);
//     });

//     return () => unsub();
//   }, [
//     studentId,
//     courseInfo,
//     student?.startMonth,
//     student?.totalFees,
//     ensureSchedules,
//   ]);

//   // When payments change, recompute paid amounts by month and update schedule docs
//   useEffect(() => {
//     if (!studentId) return;
//     if (!schedules || schedules.length === 0) return;

//     // Build a FIFO list of payments (sorted by createdAt) with remaining amounts
//     const paymentEntries = (payments || [])
//       .map((p) => ({
//         id: p.id || p.receiptUrl || Math.random().toString(36).slice(2),
//         amount: Number(p.amount) || 0,
//         receiptUrl: p.receiptUrl || p.receiptBase64 || null,
//         createdAt:
//           (p.createdAt && p.createdAt.toDate && p.createdAt.toDate()) ||
//           (p.createdAt instanceof Date ? p.createdAt : new Date()),
//         original: p,
//         remaining: Number(p.amount) || 0,
//       }))
//       .sort((a, b) => a.createdAt - b.createdAt);

//     // Prepare mapping for each schedule month -> allocated paid amount and related payments
//     const allocation = {};
//     let totalRemaining = paymentEntries.reduce((s, p) => s + p.remaining, 0);

//     // Iterate schedules in chronological order and allocate from totalRemaining (FIFO on paymentEntries)
//     for (const s of schedules) {
//       const monthId = s.month;
//       const due = Number(s.dueAmount) || 0;
//       let allocated = 0;
//       const related = [];

//       // Keep consuming from paymentEntries in FIFO order
//       while (due - allocated > 0 && paymentEntries.length > 0) {
//         const head = paymentEntries[0];
//         if (!head || head.remaining <= 0) {
//           paymentEntries.shift();
//           continue;
//         }
//         const need = due - allocated;
//         const take = Math.min(need, head.remaining);
//         allocated += take;
//         head.remaining -= take;
//         totalRemaining -= take;

//         // Push a reference to the original payment (so ReceiptList can show receipt)
//         related.push({
//           ...head.original,
//           _appliedAmount: take,
//         });

//         if (head.remaining <= 0) paymentEntries.shift();
//       }

//       let status = "未払い";
//       if (allocated <= 0) status = "未払い";
//       else if (allocated >= due) status = "支払い済み";
//       else status = "一部支払い";

//       allocation[monthId] = {
//         paid: allocated,
//         status,
//         relatedPayments: related,
//       };
//     }

//     // Apply DB updates and also attach relatedPayments to local schedules for rendering
//     const applyAllocations = async () => {
//       try {
//         const updates = [];
//         for (const s of schedules) {
//           const monthId = s.month;
//           const mapped = allocation[monthId] || { paid: 0, status: "未払い" };
//           const paid = mapped.paid || 0;
//           const status = mapped.status || "未払い";

//           const needsUpdate =
//             Number(s.paidAmount || 0) !== paid || s.status !== status;
//           if (needsUpdate) {
//             const ref = doc(
//               db,
//               "students",
//               studentId,
//               "paymentSchedules",
//               monthId
//             );
//             updates.push(
//               updateDoc(ref, {
//                 paidAmount: paid,
//                 status,
//                 updatedAt: serverTimestamp(),
//               }).catch((e) => {
//                 console.warn(`Failed to update schedule ${monthId}:`, e);
//               })
//             );
//           }
//         }
//         await Promise.all(updates);

//         // Update local schedules with relatedPayments so ReceiptList shows receipts used for each month
//         setSchedules((curr) =>
//           (curr || []).map((s) => {
//             const mapped = allocation[s.month] || {
//               paid: 0,
//               status: "未払い",
//               relatedPayments: [],
//             };
//             return {
//               ...s,
//               paidAmount: mapped.paid || 0,
//               status: mapped.status || "未払い",
//               relatedPayments: mapped.relatedPayments || [],
//             };
//           })
//         );
//       } catch (err) {
//         console.warn("Failed to apply allocations:", err);
//       }
//     };

//     applyAllocations();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [payments, schedules, studentId]);

//   const onDueChange = async (monthId, value) => {
//     if (!canEditAmounts) return;
//     const num = Math.max(0, Math.round(Number(value) || 0));
//     try {
//       const ref = doc(db, "students", studentId, "paymentSchedules", monthId);
//       await updateDoc(ref, {
//         dueAmount: num,
//         updatedAt: serverTimestamp(),
//       });
//     } catch (err) {
//       console.warn("Failed to update dueAmount:", err);
//     }
//   };

//   return (
//     <section>
//       <h2>毎月の支払い（スケジュール）</h2>
//       {creating && (
//         <div className={styles.loading}>スケジュールを作成しています…</div>
//       )}
//       <div className={styles.yearLabel}>
//         <strong>スケジュール年: {determineScheduleYear()}</strong>
//       </div>
//       <div className={styles.tableWrap}>
//         <table className={styles.table}>
//           <thead>
//             <tr>
//               <th className={styles.thLeft}>支払い月</th>
//               <th className={styles.thRight}>支払期限</th>
//               <th className={styles.thRight}>支払い金額</th>
//               <th className={styles.thCenter}>状態</th>
//               <th className={styles.thLeft}>レシート</th>
//             </tr>
//           </thead>
//           <tbody>
//             {schedules.map((s) => {
//               // Use precomputed relatedPayments (from allocation) if available; otherwise fall back to month-based filter
//               const relatedPayments =
//                 s.relatedPayments ||
//                 (payments || []).filter((p) => {
//                   const pm =
//                     p.month ||
//                     (p.createdAt?.toDate &&
//                       p.createdAt.toDate().toISOString().slice(0, 7));
//                   return pm === s.month;
//                 });

//               return (
//                 <tr key={s.id || s.month} className={styles.rowBorder}>
//                   <td className={styles.td}>{s.dueDate}</td>
//                   <td className={styles.tdRight}>{s.dueDate}</td>
//                   <td className={styles.tdRight}>
//                     {canEditAmounts ? (
//                       <input
//                         type="number"
//                         defaultValue={s.dueAmount}
//                         onBlur={(e) => onDueChange(s.month, e.target.value)}
//                         className={styles.inputAmount}
//                         disabled={!canEditAmounts}
//                         title={
//                           canEditAmounts ? "編集可能" : "先生のみ編集可能です"
//                         }
//                       />
//                     ) : (
//                       <span className={styles.amountText}>
//                         ¥{Number(s.dueAmount || 0).toLocaleString()}円
//                       </span>
//                     )}
//                   </td>
//                   <td className={styles.tdCenter}>
//                     <span
//                       className={
//                         s.status === "支払い済み"
//                           ? `${styles.statusText} ${styles.paid}`
//                           : s.status === "一部支払い"
//                           ? `${styles.statusText} ${styles.partial}`
//                           : `${styles.statusText} ${styles.unpaid}`
//                       }
//                     >
//                       {s.status}
//                     </span>
//                   </td>
//                   <td className={styles.receiptCell}>
//                     <ReceiptList payments={relatedPayments} />
//                   </td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>
//     </section>
//   );
// }
"use client";

import React, { useEffect, useState, useCallback } from "react";
import ReceiptList from "./ReceiptList";
import styles from "./PaymentSchedule.module.css";
import { useSession } from "next-auth/react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";
// Lightweight in-memory cache and in-flight request dedupe to avoid repeated
// reads when the same page/component is mounted multiple times.
const schedulesCache = new Map(); // key -> { ts, data }
const inFlightFetches = new Map(); // key -> Promise
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export default function PaymentSchedule({
  student,
  courseInfo,
  payments = [],
}) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const currentRole = session?.user?.role;
  const canEditAmounts = currentRole === "teacher" || currentRole === "admin";

  const studentId = student?.studentId;

  const determineScheduleYear = () => new Date().getFullYear();

  // Fetch schedules once per page (deduped + cached). Also create missing
  // monthly documents without doing another full read (we build created
  // payloads locally and append them to the result) so that we keep reads low.
  const fetchAndEnsureSchedules = useCallback(
    async (targetYear) => {
      if (!studentId) return [];

      const year = targetYear || determineScheduleYear();
      const cacheKey = `${studentId}-${year}`;
      const now = Date.now();

      // Return cached copy if fresh
      const cached = schedulesCache.get(cacheKey);
      if (cached && now - cached.ts < CACHE_TTL) {
        setSchedules(cached.data);
        return cached.data;
      }

      // If another fetch is in-flight for same key, await it
      if (inFlightFetches.has(cacheKey)) {
        try {
          const data = await inFlightFetches.get(cacheKey);
          setSchedules(data);
          return data;
        } catch (e) {
          inFlightFetches.delete(cacheKey);
          throw e;
        }
      }

      const p = (async () => {
        setLoading(true);
        try {
          const ref = collection(db, "students", studentId, "paymentSchedules");
          const snap = await getDocs(ref); // single read for the page

          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // Ensure months Feb(2) - Oct(10) exist. Create missing ones by
          // issuing setDoc but avoid re-reading the collection afterwards.
          const existingIds = new Set(docs.map((d) => d.id));

          const yearVal = year;
          const teacherMonthly =
            courseInfo?.pricePerMonth != null
              ? Number(courseInfo.pricePerMonth)
              : null;
          const monthlyTemplate = courseInfo?.monthlyTemplate || {};

          let base = 0;
          let remainder = 0;
          if (!teacherMonthly) {
            const total =
              Number(courseInfo?.totalFee ?? courseInfo?.pricePerMonth) ||
              student?.totalFees ||
              0;
            base = Math.floor(total / 9);
            remainder = total - base * 9;
          }

          const createdPayloads = [];
          const ops = [];
          for (let m = 2; m <= 10; m++) {
            const id = `${yearVal}-${String(m).padStart(2, "0")}`;
            if (existingIds.has(id)) continue;

            const lastDay = new Date(yearVal, m, 0);
            const dueDate = lastDay.toISOString().slice(0, 10);

            const mm = String(m).padStart(2, "0");
            let dueAmount = 0;
            if (monthlyTemplate[mm] != null) {
              dueAmount = Number(monthlyTemplate[mm]) || 0;
            } else if (teacherMonthly !== null) {
              dueAmount = teacherMonthly;
            } else {
              const extra = remainder > 0 && m - 2 < remainder ? 1 : 0;
              dueAmount = base + extra;
            }

            const payload = {
              id,
              month: id,
              dueDate,
              dueAmount,
              paidAmount: 0,
              status: "未払い",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            // record locally so we can append to result without extra read
            createdPayloads.push(payload);
            const refDoc = doc(ref, id);
            ops.push(setDoc(refDoc, payload));
          }

          // Fire off creations in parallel but don't wait for them to re-read
          // collection (we'll use combined local view instead)
          if (ops.length > 0) await Promise.all(ops);

          const combined = docs.concat(createdPayloads);

          // Filter to requested year and months, and sort
          const filtered = combined
            .filter(
              (s) =>
                typeof s.month === "string" && s.month.startsWith(`${yearVal}-`)
            )
            .filter((s) => {
              const mm = Number((s.month || "").slice(5, 7));
              return mm >= 2 && mm <= 10;
            })
            .sort((a, b) => a.month.localeCompare(b.month));

          schedulesCache.set(cacheKey, { ts: Date.now(), data: filtered });
          return filtered;
        } finally {
          setLoading(false);
        }
      })();

      inFlightFetches.set(cacheKey, p);
      try {
        const data = await p;
        inFlightFetches.delete(cacheKey);
        setSchedules(data);
        return data;
      } catch (e) {
        inFlightFetches.delete(cacheKey);
        console.warn("fetchAndEnsureSchedules failed:", e);
        throw e;
      }
    },
    // Keep deps minimal to avoid repeated calls; cache handles dedupe.
    // Do include courseInfo and student totals because they affect created dueAmount.
    [studentId, courseInfo, student?.totalFees]
  );

  // Run once when studentId changes. This fixes useEffect dependency churn and
  // ensures we do exactly one page read (deduped via cache/in-flight).
  useEffect(() => {
    if (!studentId) return;
    fetchAndEnsureSchedules();
    // Intentionally only depend on studentId so this effect doesn't re-run
    // due to parent re-renders or changed callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Allocate payments to schedule months (FIFO) and persist paidAmount/status
  // only when changed. This effect runs when `payments` or `schedules` update.
  useEffect(() => {
    if (!studentId) return;
    if (!schedules || schedules.length === 0) return;

    // Build payment entries without extra reads
    const paymentEntries = (payments || [])
      .map((p) => ({
        id: p.id || p.receiptUrl || Math.random().toString(36).slice(2),
        amount: Number(p.amount) || 0,
        createdAt:
          (p.createdAt && p.createdAt.toDate && p.createdAt.toDate()) ||
          (p.createdAt instanceof Date ? p.createdAt : new Date()),
        original: p,
        remaining: Number(p.amount) || 0,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);

    const allocation = {};
    for (const s of schedules) {
      const due = Number(s.dueAmount) || 0;
      let allocated = 0;
      const related = [];

      while (due - allocated > 0 && paymentEntries.length > 0) {
        const head = paymentEntries[0];
        if (!head || head.remaining <= 0) {
          paymentEntries.shift();
          continue;
        }
        const need = due - allocated;
        const take = Math.min(need, head.remaining);
        allocated += take;
        head.remaining -= take;
        related.push({ ...head.original, _appliedAmount: take });
        if (head.remaining <= 0) paymentEntries.shift();
      }

      let status = "未払い";
      if (allocated <= 0) status = "未払い";
      else if (allocated >= due) status = "支払い済み";
      else status = "一部支払い";

      allocation[s.month] = {
        paid: allocated,
        status,
        relatedPayments: related,
      };
    }

    // Persist only necessary updates (minimize writes as well)
    (async () => {
      try {
        const updates = [];
        for (const s of schedules) {
          const mapped = allocation[s.month] || { paid: 0, status: "未払い" };
          const paid = mapped.paid || 0;
          const status = mapped.status || "未払い";

          const needsUpdate =
            Number(s.paidAmount || 0) !== paid || s.status !== status;
          if (needsUpdate) {
            const ref = doc(
              db,
              "students",
              studentId,
              "paymentSchedules",
              s.month
            );
            updates.push(
              updateDoc(ref, {
                paidAmount: paid,
                status,
                updatedAt: serverTimestamp(),
              }).catch((e) => {
                console.warn(`Failed to update schedule ${s.month}:`, e);
              })
            );
          }
        }
        if (updates.length > 0) await Promise.all(updates);

        // Update local schedules for rendering (no extra read)
        // Only update state when something actually changed to avoid
        // infinite re-render loops (setState -> effect -> setState ...).
        try {
          const newSchedules = (schedules || []).map((s) => {
            const mapped = allocation[s.month] || {
              paid: 0,
              status: "未払い",
              relatedPayments: [],
            };
            return {
              ...s,
              paidAmount: mapped.paid || 0,
              status: mapped.status || "未払い",
              relatedPayments: mapped.relatedPayments || [],
            };
          });

          // shallow compare JSON because schedules are small (9 months)
          const prev = JSON.stringify(schedules || []);
          const next = JSON.stringify(newSchedules || []);
          if (prev !== next) {
            setSchedules(newSchedules);
          }
        } catch (e) {
          // fallback: if anything goes wrong, set schedules conservatively
          setSchedules((curr) =>
            (curr || []).map((s) => {
              const mapped = allocation[s.month] || {
                paid: 0,
                status: "未払い",
                relatedPayments: [],
              };
              return {
                ...s,
                paidAmount: mapped.paid || 0,
                status: mapped.status || "未払い",
                relatedPayments: mapped.relatedPayments || [],
              };
            })
          );
        }
      } catch (e) {
        console.warn("applyAllocations failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, schedules]);

  const onDueChange = async (monthId, value) => {
    if (!canEditAmounts) return;

    const num = Math.max(0, Math.round(Number(value) || 0));

    try {
      const ref = doc(db, "students", studentId, "paymentSchedules", monthId);
      await updateDoc(ref, { dueAmount: num, updatedAt: serverTimestamp() });

      // Update local state only
      setSchedules((prev) =>
        prev.map((s) => (s.month === monthId ? { ...s, dueAmount: num } : s))
      );
    } catch (e) {
      console.warn("Failed to update dueAmount:", e);
    }
  };

  return (
    <section>
      <h2>毎月の支払い（スケジュール）</h2>

      {loading && (
        <div className={styles.loading}>スケジュールを作成しています…</div>
      )}

      <div className={styles.yearLabel}>
        <strong>スケジュール年: {determineScheduleYear()}</strong>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>支払い月</th>
              <th>期限</th>
              <th>月額</th>
              <th>状態</th>
              <th>レシート</th>
            </tr>
          </thead>

          <tbody>
            {schedules.map((s) => (
              <tr key={s.id || s.month} className={styles.rowBorder}>
                <td>{s.month}</td>
                <td>{s.dueDate}</td>
                <td>
                  {canEditAmounts ? (
                    <input
                      type="number"
                      defaultValue={
                        // Prefer courseInfo.monthlyTemplate for display if present
                        (() => {
                          try {
                            const mm = String(s.month || "").slice(5, 7);
                            const tmpl = courseInfo?.monthlyTemplate || {};
                            if (tmpl && typeof tmpl[mm] !== "undefined")
                              return Number(tmpl[mm]) || 0;
                          } catch (e) {
                            /* ignore */
                          }
                          return s.dueAmount;
                        })()
                      }
                      onBlur={(e) => onDueChange(s.month, e.target.value)}
                      className={styles.inputAmount}
                    />
                  ) : (
                    <>
                      ¥
                      {(() => {
                        try {
                          const mm = String(s.month || "").slice(5, 7);
                          const tmpl = courseInfo?.monthlyTemplate || {};
                          if (tmpl && typeof tmpl[mm] !== "undefined")
                            return Number(tmpl[mm]).toLocaleString();
                        } catch (e) {
                          /* ignore */
                        }
                        return Number(s.dueAmount).toLocaleString();
                      })()}
                    </>
                  )}
                </td>
                <td>
                  <span
                    className={
                      s.status === "支払い済み"
                        ? `${styles.statusText} ${styles.paid}`
                        : s.status === "一部支払い"
                        ? `${styles.statusText} ${styles.partial}`
                        : `${styles.statusText} ${styles.unpaid}`
                    }
                  >
                    {s.status}
                  </span>
                </td>
                <td>
                  <ReceiptList payments={s.relatedPayments || []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
