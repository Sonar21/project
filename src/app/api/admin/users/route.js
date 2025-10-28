import { listUsers, updateUserRole } from '@/data/users';

export async function GET() {
  return new Response(JSON.stringify(listUsers()), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { studentId, role } = body;
  const updated = updateUserRole(studentId, role);
  if (!updated) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(updated), { status: 200 });
}
