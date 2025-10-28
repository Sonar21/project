import { listCourses, addCourse, deleteCourse } from "@/data/courses";

export async function GET() {
  return new Response(JSON.stringify(listCourses()), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { name, tuition } = body;
  if (!name) return new Response("Missing name", { status: 400 });
  const created = addCourse(name, tuition || 0);
  return new Response(JSON.stringify(created), { status: 201 });
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { code } = body;
    if (!code) return new Response("Missing code", { status: 400 });
    const ok = deleteCourse(code);
    if (!ok) return new Response("Not found", { status: 404 });
    return new Response("Deleted", { status: 200 });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { code, name, tuition } = body;
    if (!code) return new Response("Missing code", { status: 400 });
    const updated = updateCourse(code, { name, tuition });
    if (!updated) return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}
