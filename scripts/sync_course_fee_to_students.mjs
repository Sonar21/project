import admin from "firebase-admin";

// Usage:
// 1) Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON, or ensure
//    the environment has appropriate Application Default Credentials.
// 2) Run: node ./scripts/sync_course_fee_to_students.mjs <courseId>

if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !process.env.FIREBASE_CONFIG
) {
  console.warn(
    "\nWarning: No explicit Firebase credentials found. Make sure the environment has Application Default Credentials or set GOOGLE_APPLICATION_CREDENTIALS."
  );
}

admin.initializeApp({
  // If you want to use a specific service account JSON file, set
  // GOOGLE_APPLICATION_CREDENTIALS environment variable to its path.
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();
const BATCH_LIMIT = 500;

async function getStudentsForCourse(courseId) {
  const students = new Map();

  // Query by courseId
  const q1 = db.collection("students").where("courseId", "==", courseId);
  const snap1 = await q1.get();
  snap1.docs.forEach((d) => students.set(d.id, d));

  // Also query by courseDocId (some rows may use that field)
  const q2 = db.collection("students").where("courseDocId", "==", courseId);
  const snap2 = await q2.get();
  snap2.docs.forEach((d) => students.set(d.id, d));

  return Array.from(students.values());
}

async function main() {
  const courseId = process.argv[2];
  if (!courseId) {
    console.error(
      "Usage: node scripts/sync_course_fee_to_students.mjs <courseId>"
    );
    process.exit(1);
  }

  console.log(`Syncing students for courseId=${courseId}...`);

  // Read course document
  const courseRef = db.collection("courses").doc(courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) {
    console.error(`Course document not found: courses/${courseId}`);
    process.exit(2);
  }
  const courseData = courseSnap.data() || {};

  // Determine fee on course doc. Prefer `fee`, then `totalFee`, then `pricePerMonth`.
  const courseFeeRaw =
    courseData.fee ?? courseData.totalFee ?? courseData.pricePerMonth;
  if (courseFeeRaw == null) {
    console.error(
      "Course document does not contain fee/totalFee/pricePerMonth. Aborting."
    );
    process.exit(3);
  }
  const courseFee = Number(String(courseFeeRaw).replace(/[^0-9.-]+/g, "")) || 0;
  console.log(`Course fee determined: ${courseFee} (raw: ${courseFeeRaw})`);

  // Get students
  const students = await getStudentsForCourse(courseId);
  console.log(`Found ${students.length} student(s) for courseId=${courseId}`);

  if (students.length === 0) return;

  let batch = db.batch();
  let opCount = 0;
  let totalUpdated = 0;
  const updatedList = [];

  for (const sd of students) {
    const sid = sd.id;
    const data = sd.data() || {};

    const studentTotalFeeRaw = data.totalFee ?? data.totalFees ?? null;
    const studentTotalFee =
      studentTotalFeeRaw == null
        ? null
        : Number(String(studentTotalFeeRaw).replace(/[^0-9.-]+/g, "")) || 0;

    // If the student's stored fee is different from courseFee, update it.
    // We update both `totalFee` and `totalFees` to keep consistency.
    const needsUpdate =
      studentTotalFeeRaw == null ||
      Number(studentTotalFee) !== Number(courseFee);

    if (needsUpdate) {
      const ref = db.collection("students").doc(sid);
      batch.update(ref, {
        totalFee: courseFee,
        totalFees: courseFee,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      opCount += 1;
      totalUpdated += 1;
      updatedList.push({
        id: sid,
        name: data.name || data.displayName || null,
      });
    }

    // Commit when batch reaches limit
    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`Committed ${opCount} updates...`);
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    console.log(`Committed ${opCount} final updates...`);
  }

  console.log(`Total students updated: ${totalUpdated}`);
  if (updatedList.length > 0) {
    console.log("Updated students:");
    updatedList.forEach((u) =>
      console.log(`- ${u.id}${u.name ? " (" + u.name + ")" : ""}`)
    );
  } else {
    console.log("No students required updates.");
  }
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(10);
  });
