import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function AuthRedirectServer() {
  const session = await getServerSession(authOptions);

  if (!session) {
    // Not signed in -> go to home
    return redirect("/");
  }

  const role = session?.user?.role;
  if (role === "teacher") return redirect("/teacher/dashboard");
  return redirect("/student/dashboard");
}
