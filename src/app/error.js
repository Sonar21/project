"use client";

import React from "react";

export default function GlobalError({ error, reset }) {
  // Client-side error boundary required by Next.js App Router for interactive reset
  console.error("Unhandled error in app/error.js:", error);
  return (
    <div style={{ padding: 24 }}>
      <h1>Something went wrong</h1>
      <p>予期しないエラーが発生しました。</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {String(error?.message || error)}
      </pre>
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
