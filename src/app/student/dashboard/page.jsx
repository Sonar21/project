"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import styles from "./page.module.css";

export default function StudentPage() {
  const { data: session, status } = useSession();
  const [paid, setPaid] = useState(null);
  const [loadingPaid, setLoadingPaid] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    const studentId = session?.user?.studentId;
    if (!studentId) {
      setPaid(0);
      setLoadingPaid(false);
      return;
    }
    setLoadingPaid(true);
    fetch(`/api/student/payments?studentId=${encodeURIComponent(studentId)}`)
      .then((r) => r.json())
      .then((data) => setPaid(Number(data.paid || 0)))
      .catch(() => setPaid(0))
      .finally(() => setLoadingPaid(false));
  }, [status, session]);

  if (status === "loading") return <div>Loading session...</div>;

  // tuition may come from session (number or string). Normalize safely.
  const tuitionRaw = session?.user?.tuition;
  const total =
    tuitionRaw != null && tuitionRaw !== "" ? Number(tuitionRaw) : 480000;
  const paidVal = paid != null ? paid : 0; // if not yet loaded, treat as 0 for calculations
  const remaining = Math.max(0, total - paidVal);
  const progress =
    total > 0 ? Math.min(100, Math.max(0, (paidVal / total) * 100)) : 0;

  return (
    <main className={styles.container}>
      <header className={styles.tabs}>
        <button className={`${styles.tab} ${styles.active}`}>概要</button>
        <button className={styles.tab}>履歴</button>
        <button className={styles.tab}>プロフィール</button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={styles.logout}
        >
          ログアウト
        </button>
      </header>

      <section className={styles.card}>
        <h1 className={styles.title}>支払い状況</h1>

        <div style={{ marginBottom: 12, color: "#475569" }}>
          コース:{" "}
          {session?.user?.courseName ??
            (session?.user?.course ? session.user.course : "未設定")}
          {session?.user?.tuition ? (
            <span style={{ marginLeft: 12 }}>
              (学費:{" "}
              {new Intl.NumberFormat("ja-JP", {
                style: "currency",
                currency: "JPY",
              }).format(session.user.tuition)}
              )
            </span>
          ) : null}
        </div>

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
              {loadingPaid ? "読み込み中..." : paidVal.toLocaleString()}円
            </div>
          </article>
          <article className={styles.stat}>
            <div className={styles["stat-label"]}>残り</div>
            <div className={`${styles["stat-value"]} ${styles.remain}`}>
              {remaining.toLocaleString()}円
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
