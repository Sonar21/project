import {
  listCourses,
  addCourse,
  deleteCourse,
  updateCourse,
} from "@/data/courses";
import { adminDb, default as admin } from "@/firebase/adminApp";

export async function GET() {
  return new Response(JSON.stringify(listCourses()), { status: 200 });
}

export async function POST(req) {
  const body = await req.json();
  const { name, tuition } = body;
  if (!name) return new Response("Missing name", { status: 400 });
  const created = addCourse(name, tuition || 0);
  try {
    await adminDb.collection("courses").doc(created.code).set({
      name: created.name,
      tuition: created.tuition,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write course to Firestore (server):", err);
  }
  return new Response(JSON.stringify(created), { status: 201 });
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { code } = body;
    if (!code) return new Response("Missing code", { status: 400 });
    const ok = deleteCourse(code);
    if (!ok) return new Response("Not found", { status: 404 });
    try {
      await adminDb.collection("courses").doc(String(code)).delete();
    } catch (err) {
      console.error("Failed to delete course in Firestore (server):", err);
    }
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
    try {
      await adminDb.collection("courses").doc(String(updated.code)).set(
        {
          name: updated.name,
          tuition: updated.tuition,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to update course in Firestore (server):", err);
    }
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}
