import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// NextAuth configuration: Google login and always redirect to /student after sign in.
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // authorization params can be adjusted later to control account selection.
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "",
  callbacks: {
    // Add a role to the token and session for simple authorization in the app.
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role || token.role || "student";
      }
      token.role = token.role || "student";
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.role = token.role || "student";
      return session;
    },

    // Always redirect to /student after sign in
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/student/dashboard`;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };