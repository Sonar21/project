import { getPaidForStudent, setPaidForStudent } from "@/data/payments";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    if (!studentId) return new Response("Missing studentId", { status: 400 });
    const paid = getPaidForStudent(studentId);
    return new Response(JSON.stringify({ studentId, paid }), { status: 200 });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { studentId, paid } = body;
    if (!studentId) return new Response("Missing studentId", { status: 400 });
    const n = setPaidForStudent(studentId, paid || 0);
    return new Response(JSON.stringify({ studentId, paid: n }), {
      status: 201,
    });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}
