"use client";
import React from "react";

export default function StatCard({ title, value, color = "#2563eb", icon }) {
  return (
    <div
      className="stat-card"
      style={{
        borderTop: `4px solid ${color}`,
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: 16,
      }}
    >
      {icon ? (
        <div
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      ) : null}

      <div style={{ textAlign: "left", flex: 1 }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
          {value}
        </div>
      </div>
    </div>
  );
}
