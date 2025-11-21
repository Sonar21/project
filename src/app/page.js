import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.homeContainer}>
      <h1 className={styles.homeTitle}>ようこそ、新しい学びへ</h1>
      <div className={styles.centerArea}>
        <LoginForm />
      </div>
    </div>
  );
}
