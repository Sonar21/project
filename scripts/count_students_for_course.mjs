import adminApp, { adminDb } from "../src/firebase/adminApp.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      "Usage: node scripts/count_students_for_course.mjs <courseDocId> [courseKey]",
    );
    console.log(
      "Example: node scripts/count_students_for_course.mjs XyZabc123 web",
    );
    // list some courses for convenience
    const coursesSnap = await adminDb.collection("courses").limit(20).get();
    console.log("\nSample courses (up to 20):");
    coursesSnap.docs.forEach((d) => {
      const cd = d.data();
      console.log(
        ` - docId=${d.id}, courseKey=${cd.courseKey || "-"}, name=${
          cd.name || "-"
        }, year=${cd.year || "-"}, students=${cd.students || 0}`,
      );
    });
    process.exit(0);
  }

  const courseDocId = args[0];
  const courseKey = args[1] || null;

  console.log(
    `Counting students for courseDocId='${courseDocId}' courseKey='${courseKey}'`,
  );

  const sets = {
    byCourseId_docId: new Set(),
    byCourseId_key: new Set(),
    byCourseDocId: new Set(),
  };

  // count where courseId == courseDocId
  try {
    const snap1 = await adminDb
      .collection("students")
      .where("courseId", "==", courseDocId)
      .get();
    snap1.docs.forEach((d) => sets.byCourseId_docId.add(d.id));
    console.log(`students with courseId == docId: ${snap1.size}`);
    if (snap1.size > 0)
      console.log(
        " sample ids:",
        snap1.docs
          .slice(0, 20)
          .map((d) => d.id)
          .join(", "),
      );
  } catch (e) {
    console.error("err querying courseId==docId", e.message || e);
  }

  if (courseKey) {
    try {
      const snap2 = await adminDb
        .collection("students")
        .where("courseId", "==", courseKey)
        .get();
      snap2.docs.forEach((d) => sets.byCourseId_key.add(d.id));
      console.log(`students with courseId == courseKey: ${snap2.size}`);
      if (snap2.size > 0)
        console.log(
          " sample ids:",
          snap2.docs
            .slice(0, 20)
            .map((d) => d.id)
            .join(", "),
        );
    } catch (e) {
      console.error("err querying courseId==courseKey", e.message || e);
    }
  }

  try {
    const snap3 = await adminDb
      .collection("students")
      .where("courseDocId", "==", courseDocId)
      .get();
    snap3.docs.forEach((d) => sets.byCourseDocId.add(d.id));
    console.log(`students with courseDocId == docId: ${snap3.size}`);
    if (snap3.size > 0)
      console.log(
        " sample ids:",
        snap3.docs
          .slice(0, 20)
          .map((d) => d.id)
          .join(", "),
      );
  } catch (e) {
    console.error("err querying courseDocId==docId", e.message || e);
  }

  // union
  const union = new Set([
    ...sets.byCourseId_docId,
    ...sets.byCourseId_key,
    ...sets.byCourseDocId,
  ]);
  console.log(`\nUnique students matching any of the above: ${union.size}`);
  if (union.size > 0)
    console.log(
      " sample union ids:",
      Array.from(union).slice(0, 50).join(", "),
    );

  // Also print current course document students field
  try {
    const cSnap = await adminDb.collection("courses").doc(courseDocId).get();
    if (cSnap.exists) {
      const d = cSnap.data();
      console.log(
        `\ncourses/${courseDocId} -> students field = ${
          d.students ?? "undefined"
        }, courseKey=${d.courseKey ?? "undefined"}, name=${
          d.name ?? ""
        }, year=${d.year ?? ""}`,
      );
    } else {
      console.log(`\ncourses/${courseDocId} not found`);
    }
  } catch (e) {
    console.error("err reading course doc", e.message || e);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("failed", e);
  process.exit(1);
});
