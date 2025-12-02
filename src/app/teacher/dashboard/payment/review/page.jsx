"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import Link from "next/link";
import "./review.css";

export default function ReviewPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | pending | needs_review

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const paymentsRef = collection(db, "payments");
        // Fetch pending or needs_review; also include docs with verified=false to catch older records
        const q = query(
          paymentsRef,
          where("status", "in", ["審査中", "要確認"]),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if (!mounted) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fallback: include some from verified=false if not already present
        const extras = [];
        const seen = new Set(rows.map((r) => r.id));
        if (rows.length < 50) {
          try {
            const q2 = query(paymentsRef, where("verified", "==", false));
            const s2 = await getDocs(q2);
            s2.forEach((d) => {
              if (!seen.has(d.id)) extras.push({ id: d.id, ...d.data() });
            });
          } catch {}
        }

        const all = [...rows, ...extras];
        setPayments(all);
      } catch (e) {
        console.error("Review load error", e);
        setError("読み込みに失敗しました");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return payments
      .filter((p) => {
        if (filter === "pending") return p.status === "審査中";
        if (filter === "needs_review") return p.status === "要確認";
        return true;
      })
      .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0));
  }, [payments, filter]);

  const decide = async (paymentId, decision) => {
    try {
      const res = await fetch("/api/teacher/payments/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, decision }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      // remove from list
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (e) {
      alert("操作に失敗しました: " + (e?.message || e));
    }
  };

  return (
    <main className="reviewPage">
      <div className="reviewHeader">
        <h1>レシート審査キュー</h1>
        <div className="right">
          <label>フィルター: </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">全て</option>
            <option value="pending">審査中</option>
            <option value="needs_review">要確認</option>
          </select>
          <Link href="/teacher/dashboard/payment" className="linkBtn">
            支払いダッシュボードへ
          </Link>
        </div>
      </div>

      {loading && <div className="loading">読み込み中…</div>}
      {error && <div className="error">{error}</div>}

      <ul className="reviewList">
        {filtered.map((p) => (
          <li key={p.id} className="reviewItem">
            <div className="left">
              <div className="thumb">
                {p.receiptBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.receiptBase64} alt={`receipt-${p.id}`} />
                ) : (
                  <div className="noimg">No Image</div>
                )}
              </div>
              <div className="meta">
                <div>
                  <strong>{p.studentId}</strong> / {p.course || "未設定"}
                </div>
                <div>
                  月: {p.month || "-"} / 金額: ¥
                  {Number(p.amount || 0).toLocaleString()}
                </div>
                <div className="muted">
                  状態: {p.status || "-"} / リスク: {p.riskScore ?? 0}
                </div>
              </div>
            </div>
            <div className="actions">
              <button
                className="approve"
                onClick={() => decide(p.id, "approve")}
              >
                承認
              </button>
              <button className="reject" onClick={() => decide(p.id, "reject")}>
                却下
              </button>
            </div>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="muted">審査対象がありません。</div>
        )}
      </ul>
    </main>
  );
}
