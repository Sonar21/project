
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
      {/* <h2>毎月の支払い（スケジュール）</h2> */}

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
                <td className={styles.td}>{s.month}</td>
                <td className={styles.td}>{s.dueDate}</td>
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
