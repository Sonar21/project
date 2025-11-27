import admin from "firebase-admin";
import fs from "fs";
import path from "path";

if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !process.env.FIREBASE_CONFIG
) {
  console.warn(
    "\nWarning: No explicit Firebase credentials found. Make sure the environment has Application Default Credentials or set GOOGLE_APPLICATION_CREDENTIALS."
  );
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

async function restore(studentId, jsonPath) {
  if (!studentId || !jsonPath)
    throw new Error(
      "Usage: node restore_student_schedules.mjs <studentId> <path/to/backup.json>"
    );
  const abs = path.isAbsolute(jsonPath)
    ? jsonPath
    : path.join(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) throw new Error(`Backup file not found: ${abs}`);
  const raw = fs.readFileSync(abs, "utf8");
  const docs = JSON.parse(raw);
  if (!Array.isArray(docs))
    throw new Error("Backup JSON must be an array of schedule docs");

  console.log(
    `Restoring ${docs.length} schedule docs for ${studentId} from ${abs}`
  );
  const ops = [];
  for (const d of docs) {
    const id = d.id || d.month;
    if (!id) {
      console.warn("Skipping doc without id/month:", d);
      continue;
    }
    const ref = db
      .collection("students")
      .doc(studentId)
      .collection("paymentSchedules")
      .doc(id);
    // restore fields, but avoid restoring internal Firestore metadata
    const payload = Object.assign({}, d);
    delete payload.id;
    // If createdAt/updatedAt exist in backup as timestamps (string), leave them; otherwise set timestamps
    if (!payload.createdAt)
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    ops.push(ref.set(payload));
  }

  await Promise.all(ops.map((p) => p.catch((e) => ({ error: e }))));
  console.log(
    "Restore completed (writes issued). Verify Firestore for final state."
  );
}

async function main() {
  const studentId = process.argv[2];
  const jsonPath = process.argv[3];
  if (!studentId || !jsonPath) {
    console.error(
      "Usage: node scripts/restore_student_schedules.mjs <studentId> <path/to/backup.json>"
    );
    process.exit(1);
  }
  try {
    await restore(studentId, jsonPath);
    process.exit(0);
  } catch (err) {
    console.error("Restore failed:", err);
    process.exit(2);
  }
}

main();
