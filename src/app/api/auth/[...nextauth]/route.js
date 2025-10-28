import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createOrGetUserByEmail, getUserByEmail } from "@/data/users";
import { getTuitionForCourse, getCourse } from "@/data/courses";

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
      // On initial sign in, `user` will be present. Ensure local user exists and attach role/course/tuition.
      if (user) {
        const local = createOrGetUserByEmail(user.email, user.name);
        token.role = local.role || token.role || "student";
        token.studentId = local.studentId || token.studentId;
  token.course = local.course || null;
  token.tuition = local.course ? getTuitionForCourse(local.course) : null;
  token.courseName = local.course ? (getCourse(local.course)?.name || null) : null;
        token.email = user.email;
      } else if (token.email) {
        // subsequent requests: refresh role/course/tuition from local store
        const local = getUserByEmail(token.email);
        if (local) {
          token.role = local.role || token.role;
          token.studentId = local.studentId || token.studentId;
          token.course = local.course || token.course;
          token.tuition = local.course
            ? getTuitionForCourse(local.course)
            : token.tuition || null;
          token.courseName = local.course ? (getCourse(local.course)?.name || token.courseName || null) : token.courseName || null;
        }
      }
      token.role = token.role || "student";
      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.role = token.role || "student";
      session.user.studentId = token.studentId || null;
      session.user.course = token.course || null;
      session.user.tuition = token.tuition || null;
      session.user.courseName = token.courseName || null;
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
