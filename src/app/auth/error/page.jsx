import Link from "next/link";

export default function AuthErrorPage({ searchParams }) {
  const error = searchParams?.error || "";

  let title = "サインインエラー";
  let message = "サインインに失敗しました。もう一度お試しください。";

  // Map common NextAuth error codes to friendly Japanese messages
  switch (error) {
    case "AccessDenied":
      // Our signIn callback returns false for non-institution emails
      title = "サインイン拒否";
      message =
        "所属メールでのみサインイン可能です。osfl.ac.jp または std.it-college.ac.jp のメールアドレスでお試しください。";
      break;
    case "CredentialsSignin":
      title = "資格情報エラー";
      message = "学生番号またはパスワードが正しくありません。";
      break;
    case "Configuration":
      title = "設定エラー";
      message = "認証の設定に問題があります。管理者に連絡してください。";
      break;
    case "OAuthAccountNotLinked":
      title = "アカウントのリンクが必要です";
      message =
        "このプロバイダでサインインするには、既存アカウントとリンクする必要があります。別の方法でサインインしてください。";
      break;
    default:
      if (error) {
        message = `エラーコード: ${error}`;
      }
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "6rem auto",
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>{title}</h1>
      <p style={{ marginBottom: 20 }}>{message}</p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/login">
          <a
            style={{
              padding: "8px 16px",
              background: "#0ea5a4",
              color: "white",
              borderRadius: 6,
            }}
          >
            ログインに戻る
          </a>
        </Link>
        <Link href="/">
          <a
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: 6,
            }}
          >
            ホームへ
          </a>
        </Link>
      </div>

      <p style={{ marginTop: 28, color: "#666" }}>
        ご不明な点があれば管理者にお問い合わせください。
      </p>
    </div>
  );
}
