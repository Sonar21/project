import { listUsers, updateUserRole, setUserCourse } from "@/data/users";

export async function GET() {
  return new Response(JSON.stringify(listUsers()), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { studentId, role } = body;
  let updated = null;
  if (role) {
    updated = updateUserRole(studentId, role);
  }
  if (body.course) {
    updated = setUserCourse(studentId, body.course);
  }
  if (!updated) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(updated), { status: 200 });
}
