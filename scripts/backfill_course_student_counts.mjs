// One-time backfill: recompute courses/{courseId}.students based on enrollments.
// Usage (Windows PowerShell):
//   node ./scripts/backfill_course_student_counts.mjs

import { adminDb } from "../src/firebase/adminApp.js";
import admin from "../src/firebase/adminApp.js";

const { FieldValue } = admin.firestore;

async function main() {
  console.log("Starting backfill of course student counts...");
  const snap = await adminDb.collection("enrollments").get();

  const map = new Map(); // courseId -> count
  for (const doc of snap.docs) {
    const d = doc.data();
    if ((d?.status ?? "enrolled") !== "enrolled") continue;
    const cid = d.courseId;
    if (!cid) continue;
    map.set(cid, (map.get(cid) || 0) + 1);
  }

  const chunk = (arr, size) =>
    arr.reduce(
      (acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]),
      []
    );

  const entries = Array.from(map.entries());
  const chunks = chunk(entries, 400);

  for (const part of chunks) {
    const batch = adminDb.batch();
    for (const [courseId, count] of part) {
      const ref = adminDb.doc(`courses/${courseId}`);
      batch.set(
        ref,
        { students: count, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    console.log(`Updated ${part.length} course docs`);
  }

  console.log(
    `Done. Updated ${entries.length} course docs with computed counts.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
