"use client";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/firebase/clientApp";

export default function RecentActivity({ items = [] }) {
  const [liveItems, setLiveItems] = useState([]);

  useEffect(() => {
    // If parent provided items, don't auto-subscribe. If empty, subscribe to payments recent.
    if (items && items.length > 0) return undefined;
    const paymentsRef = collection(db, "payments");
    const q = query(paymentsRef, orderBy("createdAt", "desc"), limit(6));
    let mounted = true;
    (async () => {
      try {
        const snap = await getDocs(q);
        if (!mounted) return;
        const mapped = snap.docs.map((d) => {
          const p = d.data();
          const t =
            p.createdAt && p.createdAt.toDate
              ? p.createdAt.toDate()
              : new Date();
          const time = t.toLocaleString("ja-JP");
          let title = `${p.studentId || "unknown"} の支払いが登録されました`;
          if (p.receiptBase64 || p.receiptUrl)
            title = `${
              p.studentId || "unknown"
            } がレシートをアップロードしました`;
          const detail = `金額: ¥${Number(
            p.amount || 0
          ).toLocaleString()}  コース: ${p.course || "-"}`;
          return { title, time, detail };
        });
        setLiveItems(mapped);
      } catch (err) {
        console.error("RecentActivity getDocs error:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [items]);

  const renderItems = items && items.length > 0 ? items : liveItems;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>最近のアクティビティ</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {renderItems.length === 0 ? (
          <div style={{ color: "#6b7280" }}>アクティビティはありません。</div>
        ) : (
          renderItems.map((it, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                padding: 10,
                borderRadius: 8,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>{it.title}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>{it.time}</div>
              </div>
              {it.detail && (
                <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>
                  {it.detail}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
