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
import "./page.css";

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
    <main className="paymentPage">
      <h1 className="pageTitle">支払金 - 全ての支払い</h1>
      {loading && <div className="loading">読み込み中…</div>}

      {/* Course aggregates */}
      <div className="statsRow">
        {Object.keys(courseTotals).length === 0 ? (
          <div className="muted">集計中...</div>
        ) : (
          Object.entries(courseTotals).map(([courseKey, amt]) => (
            <div key={courseKey} className="statCard">
              <div className="statLabel">{courseKey} 合計支払額</div>
              <div className="statValue">
                ¥{Number(amt || 0).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Monthly bar chart */}
      <section className="chartSection">
        <h2 className="sectionTitle">月別支払い合計</h2>
        <div className="filterRow">
          <label htmlFor="courseSelect">コース:</label>
          <select
            id="courseSelect"
            className="courseSelect"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="all">全てのコース</option>
            {Object.keys(courseTotals).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="chartScroll">
          <div className="bars">
            {monthlyTotals.map((amt, i) => {
              const h = Math.round((amt / monthMax) * 140);
              const isMax = amt === monthMax && monthMax > 0;
              return (
                <div key={i} className="barCol">
                  <div
                    title={`¥${Number(amt || 0).toLocaleString()}`}
                    className={`bar ${isMax ? "barMax" : ""}`}
                    style={{ height: Math.max(6, h) }}
                  />
                  <div className="barMonth">{monthLabels[i]}</div>
                  <div className="barAmt">
                    ¥{Number(amt || 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
