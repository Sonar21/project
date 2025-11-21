// export { GET, POST } from "@/auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import {
  createOrGetUserByEmail,
  validateUserCredentials,
  isAllowedInstitutionEmail,
} from "@/data/users";
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
        const user = validateUserCredentials(
          credentials.studentId,
          credentials.password
        );
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
        // Only allow institutional emails for Google sign-in
        if (!isAllowedInstitutionEmail(profile.email)) return null;
        // Custom role logic for Google users
        const user = createOrGetUserByEmail(profile.email, profile.name);
        if (!user) return null;
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
          // block non-institutional emails
          if (!isAllowedInstitutionEmail(email)) return false;

          // use local part of email as studentId (matches in-memory user creation)
          const lower = String(email).toLowerCase();
          const local = lower.split("@")[0] || lower;

          const studentDocRef = adminDb
            .collection("students")
            .doc(String(local));
          let studentSnap = null;

          // Try fetching the document snapshot directly via adminDb API.
          // Wrap in try/catch because some adminDb instances or environment
          // problems can throw; on failure we'll fall back to a query below.
          try {
            studentSnap = await adminDb
              .collection("students")
              .doc(String(local))
              .get();
          } catch (e) {
            console.warn(
              "direct studentDocRef.get() threw an error — will fall back to query:",
              e && e.message ? e.message : e
            );
            studentSnap = null;
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
          if (!studentSnap || !studentSnap.exists) {
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
        // --- AFTER ENSURING STUDENT DOC EXISTS: increment matching course.students ---
        try {
          // determine a student identifier to look up the students collection
          let studentKey = null;
          if (user?.studentId)
            studentKey = String(user.studentId).toLowerCase();
          else if (user?.email)
            studentKey = String(user.email).split("@")[0].toLowerCase();
          else if (user?.id) studentKey = String(user.id);

          if (studentKey) {
            // Try direct doc fetch by studentKey first
            let sSnap = null;
            try {
              sSnap = await adminDb
                .collection("students")
                .doc(String(studentKey))
                .get();
            } catch (e) {
              sSnap = null;
            }

            // fallback: query by studentId field
            if (!sSnap || !sSnap.exists) {
              try {
                const q = await adminDb
                  .collection("students")
                  .where("studentId", "==", String(studentKey))
                  .limit(1)
                  .get();
                if (q && q.docs && q.docs.length > 0) sSnap = q.docs[0];
              } catch (qe) {
                sSnap = null;
              }
            }

            if (sSnap && sSnap.exists) {
              const sData = sSnap.data();
              // prefer an explicit courseDocId if the student doc stores it
              const explicitCourseDocId =
                sData.courseDocId || sData.courseIdDoc || null;
              const courseKey =
                sData.courseKey || sData.courseId || sData.course || null;
              // student documents may store grade/gradeEN/year/gradeJP
              let yearVal =
                sData.year ||
                sData.grade ||
                sData.gradeEN ||
                sData.gradeJP ||
                null;

              // Attempt to derive year/grade from studentId if missing
              if (!yearVal && studentKey) {
                try {
                  const id = String(studentKey || "")
                    .toLowerCase()
                    .trim();
                  const yearCode = parseInt(String(id).slice(1, 3), 10);
                  const currentYear = new Date().getFullYear();
                  let entranceYear =
                    2000 + (Number.isFinite(yearCode) ? yearCode : 0);
                  if (entranceYear > currentYear) entranceYear -= 100;
                  const gradeNum = currentYear - entranceYear + 1;
                  const ordinal = (n) => {
                    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
                    switch (n % 10) {
                      case 1:
                        return `${n}st`;
                      case 2:
                        return `${n}nd`;
                      case 3:
                        return `${n}rd`;
                      default:
                        return `${n}th`;
                    }
                  };
                  const gradeEN = `${ordinal(gradeNum)} Year`;
                  const gradeJP =
                    {
                      1: "1年生",
                      2: "2年生",
                      3: "3年生",
                      4: "4年生",
                    }[gradeNum] || `${gradeNum}年生`;

                  yearVal = gradeEN;

                  // Persist derived fields (best-effort)
                  try {
                    await adminDb
                      .collection("students")
                      .doc(String(studentKey))
                      .update({
                        grade: gradeEN,
                        gradeEN: gradeEN,
                        gradeJP: gradeJP,
                        entranceYear: entranceYear,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      });
                  } catch (upErr) {
                    console.info(
                      "signIn: could not persist derived grade fields:",
                      upErr && upErr.message ? upErr.message : upErr
                    );
                  }
                } catch (deriveErr) {
                  console.warn(
                    "signIn: failed to derive year from studentKey:",
                    deriveErr && deriveErr.message
                      ? deriveErr.message
                      : deriveErr
                  );
                }
              }

              // If student doc already references a course document, use it — this is precise
              if (explicitCourseDocId) {
                try {
                  await adminDb
                    .collection("courses")
                    .doc(explicitCourseDocId)
                    .update({
                      students: admin.firestore.FieldValue.increment(1),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } catch (uerr) {
                  console.warn(
                    "Failed to increment course.students by explicit courseDocId:",
                    uerr && uerr.message ? uerr.message : uerr
                  );
                }
              } else if (courseKey && yearVal) {
                // require both courseKey AND year to avoid ambiguous increments
                let courseDoc = null;
                try {
                  const q1 = await adminDb
                    .collection("courses")
                    .where("courseKey", "==", courseKey)
                    .where("year", "==", yearVal)
                    .limit(1)
                    .get();
                  if (q1 && q1.docs && q1.docs.length > 0)
                    courseDoc = q1.docs[0];
                } catch (err) {
                  courseDoc = null;
                }

                // try Japanese year label fallback (e.g. "1年生")
                if (
                  !courseDoc &&
                  yearVal &&
                  !String(yearVal).endsWith("Year")
                ) {
                  try {
                    const q2 = await adminDb
                      .collection("courses")
                      .where("courseKey", "==", courseKey)
                      .where("year", "==", String(yearVal))
                      .limit(1)
                      .get();
                    if (q2 && q2.docs && q2.docs.length > 0)
                      courseDoc = q2.docs[0];
                  } catch (err) {
                    courseDoc = null;
                  }
                }

                if (courseDoc) {
                  try {
                    await adminDb
                      .collection("courses")
                      .doc(courseDoc.id)
                      .update({
                        students: admin.firestore.FieldValue.increment(1),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      });
                  } catch (uerr) {
                    console.warn(
                      "Failed to increment course.students:",
                      uerr && uerr.message ? uerr.message : uerr
                    );
                  }
                } else {
                  // Ambiguous: no exact course match by courseKey+year — skip server-side increment
                  // Client-side `StudentAutoRegister` will perform a safer transaction when possible.
                  // Log for diagnostics.
                  console.info(
                    "signIn: skipping increment — no precise course match for",
                    { studentKey, courseKey, yearVal }
                  );
                }
              } else {
                // not enough data to determine precise course -> skip
                console.info(
                  "signIn: skipping increment — insufficient student course/year info",
                  { studentKey, courseKey, yearVal }
                );
              }
            }
          }
        } catch (incErr) {
          console.warn(
            "signIn: course increment failed:",
            incErr && incErr.message ? incErr.message : incErr
          );
        }

        return true;
      } catch (err) {
        console.error("signIn hook error:", err);
        // allow sign in to proceed even if Firestore operation fails
        return true;
      }
    },
    // After sign-in redirect students to student dashboard
    // Decide redirect after sign-in. Priority:
    // 1) honor relative or same-origin callbackUrl (so /auth/redirect works)
    // 2) if no callbackUrl or external, route based on token.role
    async redirect({ url, baseUrl, token }) {
      // If URL is relative, prefix with baseUrl and honor it
      if (url && url.startsWith("/")) return `${baseUrl}${url}`;
      // If URL is absolute and same-origin, honor it
      if (url) {
        try {
          const target = new URL(url);
          if (target.origin === baseUrl) return url;
        } catch (e) {
          // malformed url, proceed to token-based routing
        }
      }

      // No valid callbackUrl provided -> route based on role in token
      if (token?.role === "teacher") return `${baseUrl}/teacher/dashboard`;
      if (token?.role === "student") return `${baseUrl}/student/dashboard`;

      // Fallback to baseUrl
      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
  },
};

// ✅ Correct export for NextAuth (App Router)
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
