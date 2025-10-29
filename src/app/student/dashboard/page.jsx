"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import styles from "./page.module.css";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courseTuition, setCourseTuition] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // タブ状態

  useEffect(() => {
    // Listen to the student's Firestore document in real-time.
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    const studentId = session?.user?.studentId ||
      String(session?.user?.email || "").split("@")[0];
    if (!studentId) {
      setStudent(null);
      setLoading(false);
      return;
    }

    const studentRef = doc(db, "students", String(studentId));
    const unsub = onSnapshot(
      studentRef,
      async (snap) => {
        if (snap.exists()) {
          setStudent({ ...snap.data(), studentId });
          setLoading(false);
        } else {
          // If there's no Firestore student doc, fall back to existing API
          try {
            const res = await fetch(
              `/api/student/profile?studentId=${encodeURIComponent(studentId)}`
            );
            if (res.ok) {
              const data = await res.json();
              setStudent(Object.keys(data).length ? data : null);
            } else {
              setStudent(null);
            }
          } catch (err) {
            console.error("Error fetching student profile fallback:", err);
            setStudent(null);
          } finally {
            setLoading(false);
          }
        }
      },
      (err) => {
        console.error("Student snapshot error:", err);
        setStudent(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [status, session]);

  // Listen to Firestore course tuition for the student's enrolled course (real-time)
  useEffect(() => {
    if (!student?.course) {
      setCourseTuition(null);
      return;
    }
    const courseCode = String(student.course);
    const docRef = doc(db, "courses", courseCode);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCourseTuition(Number(d?.tuition) || 0);
        } else {
          setCourseTuition(null);
        }
      },
      (err) => {
        console.error("Course snapshot error:", err);
        setCourseTuition(null);
      }
    );
    return () => unsub();
  }, [student?.course]);

  if (status === "loading" || loading) {
    return (
      <div className={styles.center}>
        <h3>Loading your dashboard...</h3>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.center}>
        <h2>Please sign in to view your student dashboard</h2>
        <button className={styles.primaryBtn} onClick={() => signIn()}>
          Sign In
        </button>
      </div>
    );
  }

  const name = student?.name || session.user.name || "Student";
  // Prefer real-time course tuition from Firestore when available; otherwise fall back to server-side stored totalFees
  const total = (courseTuition ?? student?.totalFees) || 0;
  const paid = student?.paidAmount || 0;
  const remaining = total - paid;
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  return (
    <main className={styles.container}>
      {/* 🔹タブメニュー */}
      <header className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "overview" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          概要
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "history" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("history")}
        >
          履歴
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "profile" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("profile")}
        >
          プロフィール
        </button>
      </header>

      {/* 🔹概要タブ（支払い状況をすべて含む） */}
      {activeTab === "overview" && (
        <section className={styles.card}>
          <h1 className={styles.title}>支払い状況</h1>

          <div className={styles["progress-row"]}>
            <span className={styles.label}>支払い進捗</span>
            <span className={styles.percent}>{progress.toFixed(1)}%</span>
          </div>

          <div className={styles["progress-wrap"]}>
            <div
              className={styles["progress-bar"]}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className={styles.stats}>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>総学費</div>
              <div className={styles["stat-value"]}>
                {total.toLocaleString()}円
              </div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>支払い済み</div>
              <div className={`${styles["stat-value"]} ${styles.paid}`}>
                {paid.toLocaleString()}円
              </div>
            </article>
            <article className={styles.stat}>
              <div className={styles["stat-label"]}>残り</div>
              <div className={`${styles["stat-value"]} ${styles.remain}`}>
                {remaining.toLocaleString()}円
              </div>
            </article>
            <div className={styles.infoBox}>
              {" "}
              <div>Next payment deadline:</div>{" "}
              <div className={styles.deadline}>
                {" "}
                {student?.deadline || "Not set"}{" "}
              </div>{" "}
            </div>
          </div>
        </section>
      )}

      {/* 🔹履歴タブ */}
      {activeTab === "history" && (
        <section className={styles.card}>
          <h2>支払い履歴</h2>
          <p>まだ支払い履歴はありません。</p>
          <p>jslls</p>
        </section>
      )}

      {/* 🔹プロフィールタブ */}
      {activeTab === "profile" && (
        <section className={styles.card}>
          <h2>プロフィール情報</h2>
          <p>名前: {name}</p>
          <p>メール: {session.user.email}</p>
          <p>学籍番号: {student?.studentId || "未登録"}</p>
        </section>
      )}
    </main>
  );
}
