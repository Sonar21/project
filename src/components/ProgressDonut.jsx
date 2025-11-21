"use client";
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function ProgressDonut({ paid = 0, total = 0, size = 160 }) {
  const remaining = Math.max(total - paid, 0);
  const percent = total ? Math.round((paid / total) * 100) : 0;
  const data = [
    { name: "paid", value: Number(paid) },
    { name: "remaining", value: Number(remaining) },
  ];
  const COLORS = ["#10b981", "#e6eef8"];

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={size * 0.36}
            outerRadius={size * 0.48}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* center label */}
      <div
        style={{
          position: "absolute",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>{percent}%</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>支払い</div>
      </div>
    </div>
  );
}
