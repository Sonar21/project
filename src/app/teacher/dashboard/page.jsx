"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import "./page.css";

import Link from "next/link";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import { db } from "@/firebase/clientApp";


import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";



export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  // dynamic stats: courseCount, totalPaid, totalFees
  const [courseCount, setCourseCount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentLimit, setRecentLimit] = useState(3);

  // fetch courses count once (avoid realtime subscription)
  useEffect(() => {
    (async () => {
      try {
        const col = collection(db, "courses");
        const snap = await getDocs(col);
        setCourseCount(snap.size || 0);
      } catch (e) {
        console.warn("failed to fetch courses count:", e);
      }
    })();
  }, []);

  // fetch payments once to compute total paid (single read)
  useEffect(() => {
    (async () => {
      try {
        const col = collection(db, "payments");
        const snap = await getDocs(col);
        const paidStatusSet = new Set(["支払い済み", "paid", "completed"]);
        const sum = snap.docs.reduce((acc, d) => {
          const data = d.data() || {};
          const raw = data.amount;
          const status = (data.status || "").toString();
          if (!paidStatusSet.has(status)) return acc;
          const n = parseFloat(String(raw).replace(/[^0-9.-]+/g, ""));
          const value = Number.isFinite(n) ? n : 0;
          return acc + value;
        }, 0);
        setTotalPaid(sum);
      } catch (e) {
        console.warn("failed to fetch payments for totalPaid:", e);
      }
    })();
  }, []);

  // fetch students once to compute total fees
  useEffect(() => {
    (async () => {
      try {
        const col = collection(db, "students");
        const snap = await getDocs(col);
        const sum = snap.docs.reduce(
          (acc, d) => acc + (Number(d.data().totalFees) || 0),
          0
        );
        setTotalFees(sum);
      } catch (e) {
        console.warn("failed to fetch students for totalFees:", e);
      }
    })();
  }, []);

  // subscribe to latest `recentLimit` payments for RecentActivity
  useEffect(() => {
    const col = collection(db, "payments");
    const q = query(col, orderBy("createdAt", "desc"), limit(recentLimit));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentPayments(items);
      },
      (err) => {
        console.error("Recent payments snapshot error:", err);
        setRecentPayments([]);
      }
    );
    return () => unsub();
  }, [recentLimit]);

  const stats = [
    {
      title: "コース数",
      value: courseCount,
      color: "#4F9DDE",
      link: "/teacher/dashboard/course",
      icon: (
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect width="20" height="14" x="2" y="5" rx="2" fill="#4F9DDE" />
          <path
            d="M6 9h12"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      title: "支払金",
      value: `¥${totalPaid.toLocaleString()}`,
      color: "#57C785",
      link: "/teacher/dashboard/payment",
      icon: (
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect x="2" y="6" width="20" height="12" rx="2" fill="#57C785" />
          <path
            d="M7 12h10"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="8.5" cy="12" r="0.8" fill="#fff" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>学費管理システム・{user?.isAdmin ? "管理者用" : "教師用"}</h1>
          <div style={{ color: "#666", marginTop: 6 }}>
            ようこそ、{user?.name || "先生"} さん
          </div>
        </div>
      </header>

      {/* KPI Row - Clickable cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <Link key={index} href={stat.link} className="stat-card link-card">
            <StatCard
              title={stat.title}
              value={stat.value}
              color={stat.color}
              icon={stat.icon}
            />
          </Link>
        ))}
      </div>

      <aside>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>クイックアクション</h3>
        </div>

        <div className="card">
          {/* transform recentPayments into the display shape RecentActivity expects */}
          <RecentActivity
            items={recentPayments.map((p) => {
              const t =
                p.createdAt && p.createdAt.toDate
                  ? p.createdAt.toDate()
                  : p.createdAt && p.createdAt.seconds
                  ? new Date(p.createdAt.seconds * 1000)
                  : new Date();
              const time = t.toLocaleString("ja-JP");
              let title = `${
                p.studentId || "unknown"
              } の支払いが登録されました`;
              if (p.receiptBase64 || p.receiptUrl)
                title = `${
                  p.studentId || "unknown"
                } がレシートをアップロードしました`;
              const detail = `金額: ¥${Number(
                p.amount || 0
              ).toLocaleString()}  コース: ${p.course || "-"}`;
              return { title, time, detail };
            })}
          />
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => setRecentLimit((prev) => (prev === 3 ? 20 : 3))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#fff",
                }}
              >
                {recentLimit === 3 ? "もっと見る" : "閉じる"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
