
import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css"; 

export default function Home() {
  return (
    <div className={styles.homeContainer}>
      <h1 className={styles.homeTitle}>Hey, time to Sign In</h1>
      <LoginForm />
    </div>
  );
}
