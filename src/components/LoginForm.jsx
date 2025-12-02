"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import styles from "./LoginForm.module.css";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn("google", {
        callbackUrl: "/auth/redirect",
        prompt: "select_account",
      });
    } finally {
      // In case redirect doesn't happen (popup blockers, etc.)
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <span className={styles.logoDot} aria-hidden="true">
              P
            </span>
            <h1 className={styles.title}>
              <span className={styles.titleGradient}>PayEdu</span>
            </h1>
          </div>
          <p className={styles.sub}>学費の支払いを、もっと簡単に。</p>
          <div className={styles.decor} aria-hidden="true" />
        </div>

        <button
          className={styles.googleButton}
          onClick={handleGoogle}
          disabled={loading}
          aria-label="Google でログイン"
          aria-busy={loading}
        >
          <Image
            src="/images/social-google.svg"
            alt="Google"
            width={22}
            height={22}
            className={styles.googleIcon}
          />
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              ログイン中...
            </>
          ) : (
            <>Google でログイン</>
          )}
        </button>
      </div>
    </div>
  );
}