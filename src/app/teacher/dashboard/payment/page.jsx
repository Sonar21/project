"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";

export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseTotals, setCourseTotals] = useState({});
  const [monthlyTotals, setMonthlyTotals] = useState(new Array(12).fill(0));
  const [studentMap, setStudentMap] = useState({});
  const [selectedCourse, setSelectedCourse] = useState("all");

  useEffect(() => {
    const paymentsRef = collection(db, "payments");
    const q = query(paymentsRef, orderBy("createdAt", "desc"));
    let mounted = true;
    (async () => {
      try {
        const snap = await getDocs(q);
        if (!mounted) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPayments(data);
      } catch (err) {
        console.error("Payments getDocs error:", err);
        setPayments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const monthLabels = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];
  const monthMax = Math.max(...monthlyTotals) || 1;
  // Chart sizing controls (defaults slightly larger)
  const [chartHeight, setChartHeight] = useState(260);
  const [barWidth, setBarWidth] = useState(36);
  const [columnWidth, setColumnWidth] = useState(80);
  const barMax = Math.max(20, chartHeight - 80);

  // Aggregate payments totals per course
  useEffect(() => {
    let mounted = true;
    const compute = async () => {
      try {
        // fetch all students to allow fallback mapping from studentId -> courseId
        const studentSnap = await getDocs(collection(db, "students"));
        const studentMap = {};
        studentSnap.forEach((s) => (studentMap[String(s.id)] = s.data()));

        // expose studentMap for other consumers (monthly totals)
        if (mounted) setStudentMap(studentMap);

        const totals = {};
        for (const p of payments) {
          const sid = String(p.studentId || "");
          // prefer course stored on payment, fallback to student's courseId
          const courseKey =
            p.course ||
            (studentMap[sid] && studentMap[sid].courseId) ||
            "unknown";
          const amt = Number(p.amount) || 0;
          totals[courseKey] = (totals[courseKey] || 0) + amt;
        }

        if (!mounted) return;
        setCourseTotals(totals);
      } catch (err) {
        console.error("Failed to compute course totals:", err);
      }
    };

    compute();
    return () => {
      mounted = false;
    };
  }, [payments]);

  // Compute monthly totals (Jan..Dec) from payments.createdAt
  useEffect(() => {
    try {
      const months = new Array(12).fill(0);
      for (const p of payments) {
        let date = null;
        if (p.createdAt) {
          // Firestore Timestamp (has toDate)
          if (typeof p.createdAt.toDate === "function") {
            date = p.createdAt.toDate();
          } else if (p.createdAt.seconds) {
            // raw timestamp-like object
            date = new Date(p.createdAt.seconds * 1000);
          } else {
            date = new Date(p.createdAt);
          }
        } else {
          date = new Date();
        }

        const m = date.getMonth(); // 0..11
        const amt = Number(p.amount) || 0;

        // determine courseKey using payment.course or studentMap fallback
        const sid = String(p.studentId || "");
        const courseKey =
          p.course ||
          (studentMap && studentMap[sid] && studentMap[sid].courseId) ||
          "unknown";

        // filter by selectedCourse if set
        if (selectedCourse === "all" || selectedCourse === courseKey) {
          months[m] = (months[m] || 0) + amt;
        }
      }
      setMonthlyTotals(months);
    } catch (err) {
      console.error("Failed to compute monthly totals:", err);
    }
  }, [payments, selectedCourse, studentMap]);

  const handleDeletePayment = async (paymentId) => {
    if (!paymentId) return;
    const ok = confirm("この支払い履歴を削除してもよろしいですか？");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "payments", paymentId));
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      console.error("Failed to delete payment:", err);
      alert("削除に失敗しました。コンソールを確認してください。");
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>支払金 - 全ての支払い</h1>
      {loading && <div>読み込み中…</div>}

      {/* Course aggregates */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {Object.keys(courseTotals).length === 0 ? (
          <div style={{ color: "#666" }}>集計中...</div>
        ) : (
          Object.entries(courseTotals).map(([courseKey, amt]) => (
            <div
              key={courseKey}
              style={{
                padding: 12,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                {courseKey} 合計支払額
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                ¥{Number(amt || 0).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Monthly bar chart */}
      <div style={{ marginTop: 12 }}>
        <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>
          月別支払い合計
        </h2>
        {/* course selector */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>コース:</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 6 }}
          >
            <option value="all">全てのコース</option>
            {Object.keys(courseTotals).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "end",
            height: 180,
            padding: "8px 4px",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          {monthlyTotals.map((amt, i) => {
            const h = Math.round((amt / monthMax) * 140);
            const isMax = amt === monthMax && monthMax > 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 56,
                }}
              >
                <div
                  title={`¥${Number(amt || 0).toLocaleString()}`}
                  style={{
                    width: 28,
                    height: Math.max(6, h),
                    background: isMax ? "#1d4ed8" : "#60a5fa",
                    borderRadius: 6,
                    transition: "height 300ms ease",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                />
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  {monthLabels[i]}
                </div>
                <div style={{ fontSize: 12, color: "#444" }}>
                  ¥{Number(amt || 0).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
