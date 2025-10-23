"use client";

import React from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/auth";

export default function TeacherDashboard() {
  useRequireRole("teacher");
  return (
    <div style={{ padding: 24 }}>
      <h1>Teacher Dashboard</h1>
      <p>Welcome to the teacher dashboard.</p>
      <p>
        <Link href="/student/dashboard">Go to Student Dashboard</Link>
      </p>
    </div>
  );
}
