"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./Logout.module.css"; // 全部のページに見えるように

const Logout = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      // call signOut API to clear server-side session/cookie
      await signOut({ redirect: false });
      // Try to clear Google session by opening Google's logout endpoint in a new tab.
      // This is a best-effort attempt to force Google to show the account selector next time.
      try {
        // This will open a short-lived tab; many browsers block or block popups — it's a best-effort.
        window.open(
          "https://accounts.google.com/Logout?hl=ja",
          "_blank",
          "noopener,noreferrer",
        );
      } catch (e) {
        // ignore
      }
      // ensure client is fully cleared: navigate to home/login and force reload
      // using full reload to avoid stale client session cache
      window.location.href = "/";
    } finally {
      setLoading(false);
      try {
        // fallback navigation
        router.replace("/");
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <button
      className={styles.btn}
      type="button"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
};

export default Logout;
