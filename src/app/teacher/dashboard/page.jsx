"use client";
import { useSession } from "next-auth/react";
import "./page.css";

import Link from "next/link";

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  const stats = [
    {
      title: (
        <Link href="/teacher/dashboard/course" className="stat-card link-card">
          コース名
        </Link>
      ),
      color: "#4F9DDE",
    },

    { title: "収益合計", color: "#57C785" },
    { title: "アクティブコース", color: "#F0B84C" },
    { title: "支払い率", color: "#6C63FF" },

    //
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>学費管理システム・{user?.isAdmin ? "管理者用" : "教師用"}</h1>
        <span>ようこそ、{user?.name || "先生"} さん</span>
      </header>

      {/* === Stats Cards === */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div
            key={i}
            className="stat-card"
            style={{ borderTop: `4px solid ${s.color}` }}
          >
            <p className="stat-title">{s.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
