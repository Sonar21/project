"use client";

import React from "react";
import { useSession } from "next-auth/react";
import Logout from "./Logout";
import styles from "./Header.module.css";

const Header = () => {
  const { data: session } = useSession();

  return (
    <header className={styles.header}>
      <div className={styles.logoRow}>
        <span className={styles.logoDot} aria-hidden="true">
          P
        </span>
        <span className={styles.brandGradient}>PayEdu</span>
      </div>
      <nav>
        {session?.user ? (
          <div className={styles.right}>
            <span className={styles.user}>{session.user.name}</span>
            <Logout />
          </div>
        ) : null}
      </nav>
    </header>
  );
};

export default Header;
