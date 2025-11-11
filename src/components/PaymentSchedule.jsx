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
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";

// Props: student (object), courseInfo (object), payments (array)
export default function PaymentSchedule({
  student,
  courseInfo,
  payments = [],
}) {
  const [schedules, setSchedules] = useState([]);
  const [creating, setCreating] = useState(false);

  const { data: session } = useSession();
  const currentRole = session?.user?.role;
  const canEditAmounts = currentRole === "teacher" || currentRole === "admin";

  // Guard
  const studentId = student?.studentId;

  const determineScheduleYear = (startMonth) => {
    // Use the current calendar year for schedules (display Feb-Oct of current year)
    return new Date().getFullYear();
  };

  const ensureSchedules = useCallback(
    async (targetYear) => {
      if (!studentId) return;
      setCreating(true);
      try {
        const schedulesRef = collection(
          db,
          "students",
          studentId,
          "paymentSchedules"
        );
        const snap = await getDocs(schedulesRef);
        const existingIds = new Set(snap.docs.map((d) => d.id));

        // Determine year: allow targetYear override, else compute from student.startMonth
        let year = targetYear || determineScheduleYear(student?.startMonth);

        // Determine desired per-month dueAmount
        const teacherMonthly =
          courseInfo && Number(courseInfo.pricePerMonth)
            ? Math.max(0, Math.round(Number(courseInfo.pricePerMonth)))
            : null;

        // If teacherMonthly is provided, use it for each month; otherwise distribute total across 9 months
        let base = 0;
        let remainder = 0;
        if (!teacherMonthly) {
          const total = Number(
            (courseInfo && (courseInfo.totalFee ?? courseInfo.pricePerMonth)) ||
              student?.totalFees ||
              0
          );
          base = Math.floor(total / 9);
          remainder = total - base * 9;
        }

        // Create or update documents for months Feb (2) -> Oct (10)
        const createOrUpdatePromises = [];
        const createdMonths = [];
        const updatedMonths = [];
        for (let m = 2; m <= 10; m++) {
          const monthStr = `${year}-${String(m).padStart(2, "0")}`; // id

          // last day of month
          const lastDay = new Date(year, m, 0); // day 0 of next month
          const dueDate = lastDay.toISOString().slice(0, 10); // YYYY-MM-DD

          // determine desired dueAmount
          let desiredDue = 0;
          if (teacherMonthly !== null) desiredDue = teacherMonthly;
          else {
            const extra = remainder > 0 && m - 2 < remainder ? 1 : 0;
            desiredDue = base + extra;
          }

          const docRef = doc(schedulesRef, monthStr);

          if (!existingIds.has(monthStr)) {
            const payload = {
              month: monthStr,
              dueDate,
              dueAmount: desiredDue,
              paidAmount: 0,
              status: "未払い",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            createOrUpdatePromises.push(setDoc(docRef, payload));
            createdMonths.push(monthStr);
          } else {
            // existing doc: check if dueAmount differs and update
            const existingDoc = snap.docs.find((d) => d.id === monthStr);
            const existingDue = Number(existingDoc?.data()?.dueAmount) || 0;
            if (existingDue !== desiredDue) {
              createOrUpdatePromises.push(
                updateDoc(docRef, {
                  dueAmount: desiredDue,
                  updatedAt: serverTimestamp(),
                })
              );
              updatedMonths.push(monthStr);
            }
          }
        }
        await Promise.all(createOrUpdatePromises);
        if (createdMonths.length > 0) {
          console.info(
            "Created payment schedule months:",
            createdMonths.join(", ")
          );
        } else {
          console.info("No missing months to create for year", year);
        }
        if (updatedMonths.length > 0) {
          console.info(
            "Updated existing payment schedule dueAmount for months:",
            updatedMonths.join(", ")
          );
        }
      } catch (err) {
        console.warn("Failed to create payment schedules:", err);
      } finally {
        setCreating(false);
      }
    },
    [studentId, courseInfo, student?.startMonth, student?.totalFees]
  );

  useEffect(() => {
    if (!studentId) return;

    // For debugging: print computed schedule year
    try {
      console.debug(
        "determineScheduleYear (current):",
        determineScheduleYear()
      );
    } catch (e) {
      /* ignore */
    }

    // initial ensure using computed year (based on startMonth or current date)
    ensureSchedules();

    const schedulesRef = collection(
      db,
      "students",
      studentId,
      "paymentSchedules"
    );
    const q = query(schedulesRef);
    const unsub = onSnapshot(q, (snap) => {
      const year = determineScheduleYear();
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => {
          const m = item.month || item.id;
          if (!m || typeof m !== "string" || m.length < 7) return false;
          if (!m.startsWith(`${year}-`)) return false;
          const mm = Number(m.slice(5, 7));
          return mm >= 2 && mm <= 10;
        })
        .sort((a, b) => a.month.localeCompare(b.month));
      setSchedules(data);
    });

    return () => unsub();
  }, [
    studentId,
    courseInfo,
    student?.startMonth,
    student?.totalFees,
    ensureSchedules,
  ]);

  // When payments change, recompute paid amounts by month and update schedule docs
  useEffect(() => {
    if (!studentId) return;
    if (!schedules || schedules.length === 0) return;

    // Aggregate payments by month string YYYY-MM
    const paymentsByMonth = {};
    for (const p of payments || []) {
      let pm = p.month;
      if (!pm && p.createdAt && p.createdAt.toDate) {
        pm = p.createdAt.toDate().toISOString().slice(0, 7);
      }
      if (!pm) continue;
      paymentsByMonth[pm] =
        (paymentsByMonth[pm] || 0) + (Number(p.amount) || 0);
    }

    // Update schedule docs if paidAmount or status differ
    const applyUpdates = async () => {
      try {
        for (const s of schedules) {
          const month = s.month;
          const paid = paymentsByMonth[month] || 0;
          const due = Number(s.dueAmount) || 0;
          let status = "未払い";
          if (paid <= 0) status = "未払い";
          else if (paid >= due) status = "支払い済み";
          else status = "一部支払い";

          const needsUpdate =
            Number(s.paidAmount || 0) !== paid || s.status !== status;
          if (needsUpdate) {
            const ref = doc(
              db,
              "students",
              studentId,
              "paymentSchedules",
              month
            );
            await updateDoc(ref, {
              paidAmount: paid,
              status,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.warn("Failed to sync payments to schedules:", err);
      }
    };

    applyUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, schedules, studentId]);

  const onDueChange = async (monthId, value) => {
    if (!canEditAmounts) return;
    const num = Math.max(0, Math.round(Number(value) || 0));
    try {
      const ref = doc(db, "students", studentId, "paymentSchedules", monthId);
      await updateDoc(ref, {
        dueAmount: num,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to update dueAmount:", err);
    }
  };

  return (
    <section>
      <h2>毎月の支払い（スケジュール）</h2>
      {creating && (
        <div className={styles.loading}>スケジュールを作成しています…</div>
      )}
      <div className={styles.yearLabel}>
        <strong>スケジュール年: {determineScheduleYear()}</strong>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>支払い月</th>
              <th className={styles.thRight}>支払期限</th>
              <th className={styles.thRight}>支払い金額</th>
              <th className={styles.thCenter}>状態</th>
              <th className={styles.thLeft}>レシート</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => {
              const relatedPayments = (payments || []).filter((p) => {
                const pm =
                  p.month ||
                  (p.createdAt?.toDate &&
                    p.createdAt.toDate().toISOString().slice(0, 7));
                return pm === s.month;
              });

              return (
                <tr key={s.id || s.month} className={styles.rowBorder}>
                  <td className={styles.td}>{s.dueDate}</td>
                  <td className={styles.tdRight}>{s.dueDate}</td>
                  <td className={styles.tdRight}>
                    {canEditAmounts ? (
                      <input
                        type="number"
                        defaultValue={s.dueAmount}
                        onBlur={(e) => onDueChange(s.month, e.target.value)}
                        className={styles.inputAmount}
                        disabled={!canEditAmounts}
                        title={
                          canEditAmounts ? "編集可能" : "先生のみ編集可能です"
                        }
                      />
                    ) : (
                      <span className={styles.amountText}>
                        ¥{Number(s.dueAmount || 0).toLocaleString()}円
                      </span>
                    )}
                  </td>
                  <td className={styles.tdCenter}>
                    <span className={styles.statusText}>{s.status}</span>
                  </td>
                  <td className={styles.receiptCell}>
                    <ReceiptList payments={relatedPayments} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
