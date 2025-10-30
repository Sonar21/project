// export { GET, POST } from "@/auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { createOrGetUserByEmail, validateUserCredentials } from "@/data/users";

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
  },

  pages: {
    signIn: "/login",
  },
};

// ✅ Correct export for NextAuth (App Router)
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };