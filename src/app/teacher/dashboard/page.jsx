"use client";
import { useSession } from "next-auth/react";
import "./page.css";

import Link from "next/link";
import StatCard from "@/components/StatCard";
import ProgressDonut from "@/components/ProgressDonut";
import RecentActivity from "@/components/RecentActivity";

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  // Placeholder stats — these can be replaced with real queries
  const stats = [
    { title: "コース数", value: 12, color: "#4F9DDE" },
    { title: "収益合計", value: "¥1,234,567", color: "#57C785" },
    { title: "アクティブコース", value: 5, color: "#F0B84C" },
    { title: "支払い率", value: "72%", color: "#6C63FF" },
  ];

  const recent = [
    { title: "学生 w24006 がレシートをアップロード", time: "10:14" },
    { title: "支払い 86,000円 が登録されました", time: "2025/11/13" },
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

      {/* KPI Row */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <StatCard key={i} title={s.title} value={s.value} color={s.color} />
        ))}
      </div>

      {/* Main grid: donut + course list / recent activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 20,
          marginTop: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 180 }}>
              <ProgressDonut paid={720000} total={1234567} size={160} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  background: "#fff",
                  padding: 16,
                  borderRadius: 12,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <h3 style={{ margin: 0 }}>コース一覧</h3>
                <p style={{ marginTop: 8, color: "#6b7280" }}>
                  コースを選択して詳細を表示します。
                </p>
                <div style={{ marginTop: 12 }}>
                  <Link
                    href="/teacher/dashboard/course"
                    className="stat-card link-card"
                  >
                    コース管理へ
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder for course list */}
          <div
            style={{
              marginTop: 18,
              background: "#fff",
              padding: 14,
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
           
          </div>
        </div>

        <aside>
          <div
            style={{
              background: "#fff",
              padding: 14,
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>クイックアクション</h3>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              
            </div>
          </div>

          <div style={{ background: "#fff", padding: 12, borderRadius: 12 }}>
            <RecentActivity items={recent} />
          </div>
        </aside>
      </div>
    </div>
  );
}
