import { listUsers, updateUserRole, updateUser } from "@/data/users";
import { adminDb, default as admin } from "@/firebase/adminApp";

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
  // allow updating course, name or email via updateUser
  if (body.course || body.name || body.email) {
    // update in-memory user
    updated = updateUser(studentId, {
      course: body.course,
      name: body.name,
      email: body.email,
    });
    // write the student's Firestore doc so student dashboard can read updated fields
    try {
      const writeData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (body.course) writeData.course = body.course;
      if (body.name) writeData.name = body.name;
      if (body.email) writeData.email = body.email;
      await adminDb
        .collection("students")
        .doc(String(studentId))
        .set(writeData, { merge: true });
    } catch (err) {
      console.error("Failed to write student data to Firestore (server):", err);
    }
  }
  if (!updated) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(updated), { status: 200 });
}
