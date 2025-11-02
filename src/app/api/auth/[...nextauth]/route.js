// export { GET, POST } from "@/auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createOrGetUserByEmail, validateUserCredentials } from "@/data/users";
import admin, { adminDb } from "@/firebase/adminApp";

// Define your auth options first
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        studentId: { label: "Student ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = validateUserCredentials(credentials.studentId, credentials.password);
        if (user) return user;
        return null;
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      async profile(profile) {
        // Custom role logic for Google users
        const user = createOrGetUserByEmail(profile.email, profile.name);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.role) session.user.role = token.role;
      return session;
    },
    // Create student doc on Google sign-in if missing
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google") {
          const email = user?.email;
          if (!email) return true;

          // use local part of email as studentId (matches in-memory user creation)
          const lower = String(email).toLowerCase();
          const local = lower.split("@")[0] || lower;

          const studentDocRef = adminDb.collection("students").doc(String(local));
          let studentSnap = null;

          // If the DocumentReference exposes get(), use it; otherwise fall back to a query.
          if (studentDocRef && typeof studentDocRef.get === "function") {
            try {
              studentSnap = await studentDocRef.get();
            } catch (e) {
              console.warn(
                "studentDocRef.get() threw an error — will fall back to query:",
                e && e.message ? e.message : e
              );
            }
          } else {
            console.warn(
              "studentDocRef.get is not a function; falling back to query by studentId"
            );
          }

          // Fallback: query by studentId if we didn't obtain a document snapshot above
          if (!studentSnap) {
            try {
              const q = adminDb
                .collection("students")
                .where("studentId", "==", String(local))
                .limit(1);
              const qSnap = await q.get();
              if (qSnap && qSnap.docs && qSnap.docs.length > 0) {
                studentSnap = qSnap.docs[0];
              }
            } catch (qe) {
              console.error("Fallback query for student document failed:", qe);
            }
          }
          if (!studentSnap.exists) {
            // determine courseId from email (simple heuristic)
            let courseId = "";
            if (lower.includes("web")) courseId = "web";
            else if (lower.includes("hotel")) courseId = "hotel";
            else if (lower.includes("digital")) courseId = "digital";

            await studentDocRef.set({
              studentId: local,
              email: email,
              name: user?.name || "",
              nameKana: "",
              courseId: courseId,
              startMonth: "",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        return true;
      } catch (err) {
        console.error("signIn hook error:", err);
        // allow sign in to proceed even if Firestore operation fails
        return true;
      }
    },
    // After sign-in redirect students to student dashboard
    async redirect({ url, baseUrl }) {
      // Always redirect to student dashboard after sign-in
      return "\/student\/dashboard";
    },
  },

  pages: {
    signIn: "/login",
  },
};

// ✅ Correct export for NextAuth (App Router)
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };