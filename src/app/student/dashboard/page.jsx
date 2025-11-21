"use client";

import React from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function StudentPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading session...</div>;

  if (status === "unauthenticated") {
    return (
      <div style={{ padding: 24 }}>
        <h1>Student area</h1>
        <p>You need to sign in to view this page.</p>
        <button onClick={() => signIn("google", { callbackUrl: "/student/dashboard" })}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Student Dashboard</h1>
      <p>Welcome, {session?.user?.name ?? session?.user?.email}.</p>
      <p>Your role: {session?.user?.role}</p>
      <div style={{ marginTop: 16 }}>
        <button onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
      </div>
    </div>
  );
}
