import { getUserByEmail, getUserByStudentId } from '@/data/users';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const studentId = url.searchParams.get('studentId');
    let user = null;
    if (email) user = getUserByEmail(email);
    else if (studentId) user = getUserByStudentId(studentId);
    if (!user) return new Response(JSON.stringify({}), { status: 200 });
    return new Response(JSON.stringify(user), { status: 200 });
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
}
