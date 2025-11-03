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
  const { name, nameJa, nameEn, tuition, tuitionByYear } = body;
  if (!name && !nameJa && !nameEn)
    return new Response("Missing name (provide name or nameJa/nameEn)", {
      status: 400,
    });
  const created = addCourse(name || nameJa || nameEn, tuition || 0);
  try {
    const writeObj = {
      name: created.name,
      nameJa: nameJa || null,
      nameEn: nameEn || null,
      tuition: created.tuition,
      courseKey: created.code,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (tuitionByYear && typeof tuitionByYear === "object") {
      writeObj.tuitionByYear = tuitionByYear;
    }
    await adminDb.collection("courses").doc(created.code).set(writeObj);
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
    const { code, name, nameJa, nameEn, tuition, tuitionByYear } = body;
    if (!code) return new Response("Missing code", { status: 400 });
    const updated = updateCourse(code, { name, tuition, tuitionByYear });
    if (!updated) return new Response("Not found", { status: 404 });
    try {
      const writeObj = {
        name: updated.name,
        nameJa: nameJa || updated.nameJa || null,
        nameEn: nameEn || updated.nameEn || null,
        tuition: updated.tuition,
        courseKey: updated.code,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (tuitionByYear && typeof tuitionByYear === "object") {
        writeObj.tuitionByYear = tuitionByYear;
      } else if (updated.tuitionByYear !== undefined) {
        // if updated object contains tuitionByYear (possibly null), persist it
        writeObj.tuitionByYear = updated.tuitionByYear;
      }
      await adminDb
        .collection("courses")
        .doc(String(updated.code))
        .set(writeObj, { merge: true });
    } catch (err) {
      console.error("Failed to update course in Firestore (server):", err);
    }
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
}
