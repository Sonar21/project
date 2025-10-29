"use client";

import React, { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
// import { doc, getDoc } from "firebase/firestore";
// import { db } from "@/firebase/clientApp";
import styles from "./page.module.css";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      if (status === "authenticated" && session?.user?.email) {
        try {
          const docRef = doc(db, "students", session.user.email);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setStudent(docSnap.data());
          } else {
            console.log("No such document!");
          }
        } catch (error) {
          console.error("Error fetching student data:", error);
        }
      }
      setLoading(false);
    }

    fetchStudent();
  }, [status, session]);

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
  const total = student?.totalFees || 0;
  const paid = student?.paidAmount || 0;
  const remaining = total - paid;
  const progress = total ? Math.min((paid / total) * 100, 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Top header */}
        <div className={styles.top}>
          <div className={styles.title}>🎓 Student Dashboard</div>
          <div className={styles.sessionRight}>
            <div className={styles.userName}>{name}</div>
            <button className={styles.logout} onClick={() => signOut()}>
              Logout
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className={styles.mainGrid}>
          {/* Left side */}
          <div className={styles.leftCard}>
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className={styles.progressText}>{progress.toFixed(0)}%</div>
            </div>

            <div className={styles.amountRow}>
              <div className={styles.cardSmall}>
                <div className={styles.amount}>¥{total}</div>
                <div className={styles.cardLabel}>Total Fees</div>
              </div>
              <div className={styles.cardSmall}>
                <div className={styles.amount}>¥{paid}</div>
                <div className={styles.cardLabel}>Paid</div>
              </div>
              <div className={styles.cardSmall}>
                <div className={styles.amount}>¥{remaining}</div>
                <div className={styles.cardLabel}>Remaining</div>
              </div>
            </div>

            <div className={styles.infoBox}>
              <div>Next payment deadline:</div>
              <div className={styles.deadline}>
                {student?.deadline || "Not set"}
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryBtn}>Pay Now</button>
              <button className={styles.secondaryBtn}>View History</button>
            </div>
          </div>

          {/* Right side */}
          <div className={styles.rightCard}>
            <div className={styles.profileBox}>
              <div className={styles.avatar}>
                {name ? name[0].toUpperCase() : "S"}
              </div>
              <div className={styles.profileText}>
                <div className={styles.profileName}>{name}</div>
                <div className={styles.smallText}>
                  {student?.studentId || "Student ID N/A"}
                </div>
              </div>
            </div>

            <div className={styles.smallText}>Email: {session.user.email}</div>
            <div className={styles.smallText}>
              Major: {student?.major || "Not registered"}
            </div>
            <div className={styles.safeNote}>
              ✅ Your information is secure and up-to-date.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
