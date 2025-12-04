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

async function dump(studentId) {
  if (!studentId) throw new Error("studentId required");
  const col = db
    .collection("students")
    .doc(studentId)
    .collection("paymentSchedules");
  const snap = await col.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const outDir = path.join(process.cwd(), "scripts", "backups");
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {}
  const outFile = path.join(
    outDir,
    `${studentId}_paymentSchedules_${Date.now()}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify(docs, null, 2), "utf8");
  console.log(`Dumped ${docs.length} schedule docs to ${outFile}`);
}

async function main() {
  const studentId = process.argv[2];
  if (!studentId) {
    console.error("Usage: node scripts/dump_student_schedules.mjs <studentId>");
    process.exit(1);
  }
  try {
    await dump(studentId);
    process.exit(0);
  } catch (err) {
    console.error("Dump failed:", err);
    process.exit(2);
  }
}

main();
