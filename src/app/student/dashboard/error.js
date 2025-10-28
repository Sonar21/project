"use client";

import React from "react";

export default function StudentDashboardError({ error, reset }) {
  console.error("Error in student/dashboard segment:", error);
  return (
    <div style={{ padding: 24 }}>
      <h1>Something went wrong in Student Dashboard</h1>
      <p>{String(error?.message ?? error)}</p>
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => {
            if (typeof reset === "function") reset();
            else window.location.reload();
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
