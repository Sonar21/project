"use client";
import React from "react";

export default function StatCard({
  title,
  value,
  sub,
  color = "#2563eb",
  href,
}) {
  return (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
