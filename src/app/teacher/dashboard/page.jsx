"use client";
import { useSession } from "next-auth/react";
import "./page.css";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const user = session?.user;

  const stats = [
    { title: "コース名", value: "1,247", sub: "+12% from last month", color: "#4F9DDE" },
    // { title: "収益合計", value: "$2.4M", sub: "+8% from last month", color: "#57C785" },
    // { title: "アクティブコース", value: "24", sub: "2 new this semester", color: "#F0B84C" },
    // { title: "支払い率", value: "89%", sub: "+3% from last month", color: "#6C63FF" },
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

  
    </div>
  );
}
