"use client";
import React from "react";

export default function RecentActivity({ items = [] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>最近のアクティビティ</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>アクティビティはありません。</div>
        ) : (
          items.map((it, i) => (
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
