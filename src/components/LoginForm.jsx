import { doSocialLogin } from "@/app/actions";

const LoginForm = () => {
    return (
        <form action={doSocialLogin}>
            {/* <button className="bg-pink-400 text-white p-1 rounded-md m-1 text-lg" type="submit" name="action" value="google">
                change with google
            </button>

            <button className="bg-black text-white p-1 rounded-md m-1 text-lg" type="submit" name="action" value="github">
                Sign In With GitHub
            </button> */}
            
            
        </form>
    );
};

export default LoginForm;

// "use client";

// import React, { useState } from "react";
// import { signIn } from "next-auth/react";
// import Link from "next/link";
// import styles from "./page.module.css";
// import Image from "next/image";

// const SignInPage: React.FC = () => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError(null);
//     setLoading(true);

//     const fd = new FormData(e.currentTarget as HTMLFormElement);
//     const email = String(fd.get("email") ?? "");
//     const password = String(fd.get("password") ?? "");

//     const res = await signIn("credentials", {
//       redirect: false,
//       email,
//       password,
//     });

//     setLoading(false);
//     // next-auth の戻り値は any なので簡易チェック
//     if (res && (res as any).error) {
//       setError("ログインに失敗しました。資格情報を確認してください。");
//     }
//   };

//   const handleGoogle = async () => {
//     setLoading(true);
//     await signIn("google", { callbackUrl: "/" });
//     setLoading(false);
//   };

//   return (
//     <div className={styles.page}>
//       <div className={styles.container}>
//         <div className={styles.card}>
//           <div className={styles.brand}>PayEdu</div>
//           <p className={styles.subtitle}>Welcome to PayEdu </p>

//           <form onSubmit={handleSubmit} className={styles.form}>
//             <label className={styles.label}>
//               Email
//               <input
//                 name="email"
//                 type="email"
//                 required
//                 className={styles.input}
//                 placeholder="ｆｊｇｊ"
//               />
//             </label>

//             <label className={styles.label}>
//               Password
//               <input
//                 name="password"
//                 type="password"
//                 required
//                 className={styles.input}
//                 placeholder="••••••••"
//               />
//             </label>

//             {error && <div className={styles.error}>{error}</div>}

//             <button
//               type="submit"
//               className={styles.loginBtn}
//               disabled={loading}
//             >
//               {loading ? "Signing in..." : "Sign in"}
//             </button>
//           </form>

//           <div className={styles.divider}>
//             <span className={styles.line} />
//             <span className={styles.or}>OR</span>
//             <span className={styles.line} />
//           </div>

//           <button
//             type="button"
//             className={styles.googleBtn}
//             onClick={handleGoogle}
//             disabled={loading}
//             aria-label="Sign in with Google"
//           >
//             <Image
//               src="/images/google.svg"
//               alt="Google logo"
//               width={20}
//               height={20}
//               style={{ marginRight: 8 }}
//             />
//             Googleでログイン
//           </button>

//           <div className={styles.forgot}>
//             <Link href="#" className={styles.link}>
//               Forgot password?
//             </Link>
//           </div>
//         </div>

//         <div className={styles.signup}>
//           <span>Don't have an account? </span>
//           <Link href="/sign-up" className={styles.linkBold}>
//             Sign up
//           </Link>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default SignInPage;
// // ...existing code...
