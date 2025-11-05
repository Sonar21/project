"use client";

import React from "react";
import { useRequireRole } from "@/lib/auth";

export default function TeacherLayout({ children }) {
  // Redirect non-teachers away from /teacher routes
  useRequireRole("teacher");
  return <>{children}</>;
}
