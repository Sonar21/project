"use client";

import React, { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./LoginForm.module.css";
import Image from "next/image";

const LoginForm = () => {
    return (
        <form action={doSocialLogin}>
            <button className="bg-pink-400 text-white p-1 rounded-md m-1 text-lg" type="submit" name="action" value="google">
                change with google
            </button>
        </form>
    );
};

const SignInPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const studentId = String(fd.get("studentId") ?? "");
    const password = String(fd.get("password") ?? "");

    const res = await signIn("credentials", {
      redirect: false,
      studentId,
      password,
    });

    console.log("signIn result:", res);

    setLoading(false);
    // next-auth の戻り値は any なので簡易チェック
    if (res && res.error) {
      // show provider returned message when available
      setError(
        res.error || "ログインに失敗しました。資格情報を確認してください。"
      );
      return;
    }

    // successful credentials sign-in
    if (res && !res.error) {
      // To avoid race conditions where the client session isn't available immediately,
      // redirect to the shared /auth/redirect page which waits for session.status and
      // then routes to the proper dashboard based on role.
      router.push("/auth/redirect");
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Redirect to Google sign-in, then back to /auth/redirect where we'll handle routing
    await signIn("google", {
      callbackUrl: "/auth/redirect",
      prompt: "select_account",
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.brand}>PayEdu</div>
          <p className={styles.subtitle}>Welcome to PayEdu </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label}>
              学生番号
              <input
                name="studentId"
                type="text"
                required
                className={styles.input}
                placeholder="あなたの学生番号"
              />
            </label>

            <label className={styles.label}>
              Password
              <input
                name="password"
                type="password"
                required
                className={styles.input}
                placeholder="••••••••"
              />
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.loginBtn}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.line} />
            <span className={styles.or}>OR</span>
            <span className={styles.line} />
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={loading}
            aria-label="Sign in with Google"
          >
            <Image
              src="/images/social-google.svg"
              alt="Google logo"
              width={20}
              height={20}
              style={{ marginRight: 8 }}
            />
            Googleでログイン
          </button>

          <div className={styles.forgot}>
            <Link href="#" className={styles.link}>
              Forgot password?
            </Link>
          </div>
        </div>

        <div className={styles.signup}>
          <span>Don&apos;t have an account? </span>
          <Link href="/sign-up" className={styles.linkBold}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;

