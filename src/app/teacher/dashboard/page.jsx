"use client";
import { useSession } from "next-auth/react";
import "./page.css";
import AddCourseForm from "@/components/AddCourseForm";
import Link from "next/link";

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  const stats = [
   
    {
    title: (
      <Link href="/teacher/dashboard/course" className="link-title">
        コース名
      </Link>
    ),
   
  },
    {
      title: (
        <Link href="/teacher/dashboard/revenue" className="link-title">
          収益合計
        </Link>
      ),
      value: "$2.4M",
      sub: "+8% from last month",
      color: "#57C785",
    },
    {
      title: (
        <Link href="/teacher/dashboard/courses" className="link-title">
          アクティブコース
        </Link>
      ),
      value: "24",
      sub: "2 new this semester",
      color: "#F0B84C",
    },
    {
      title: (
        <Link href="/teacher/dashboard/payments" className="link-title">
          支払い率
        </Link>
      ),
      value: "89%",
      sub: "+3% from last month",
      color: "#6C63FF",
    },
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
          <div key={i} className="stat-card" style={{ borderTop: `4px solid ${s.color}` }}>
            <p className="stat-title">{s.title}</p>
            <h2 className="stat-value">{s.value}</h2>
            <p className="stat-sub">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* === Course creation form for teachers === */}
      <section style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>新しいコースを追加</h3>
        <AddCourseForm />
      </section>

    </div>
  );
}