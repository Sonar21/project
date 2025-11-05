import adminApp, { adminDb } from "../src/firebase/adminApp.js";

async function slugify(name) {
  const s = String(name || "").trim();
  // Prefer ASCII words if present (e.g. "Web プログラミング" -> "web")
  const asciiMatch = s.match(/[A-Za-z0-9]+/g);
  if (asciiMatch && asciiMatch.length > 0) {
    // Join multiple ASCII words with '-' so multi-word names keep readable slugs
    return String(asciiMatch.join("-")).toLowerCase().slice(0, 40);
  }

  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (slug) return slug;

  // Fallback to a timestamp-based key to avoid empty courseKey values
  return `course-${Date.now().toString(36)}`.slice(0, 40);
}

async function main() {
  console.log("Starting courseKey migration...");

  // 1) Load courses and ensure every course has a courseKey
  const coursesSnap = await adminDb.collection("courses").get();
  const idToKey = {};
  const keyToId = {};

  for (const doc of coursesSnap.docs) {
    const data = doc.data();
    let key = data.courseKey;
    if (!key || String(key).trim() === "") {
      key = await slugify(data.name || doc.id);
      try {
        await adminDb.collection("courses").doc(doc.id).update({
          courseKey: key,
        });
        console.log(`Set courseKey='${key}' for course ${doc.id}`);
      } catch (e) {
        console.error("Failed to set courseKey for", doc.id, e);
      }
    }
    idToKey[doc.id] = key;
    keyToId[key] = doc.id;
  }

  // 2) Reset students counts to 0
  for (const doc of coursesSnap.docs) {
    try {
      await adminDb.collection("courses").doc(doc.id).update({ students: 0 });
    } catch (e) {
      // ignore
    }
  }

  // 3) Iterate students and migrate courseId (doc id) -> courseKey, and build counts
  const studentsSnap = await adminDb.collection("students").get();
  const counts = {};
  for (const s of studentsSnap.docs) {
    const sd = s.data();
    const old = sd.courseId;
    if (!old) continue;

    // if old matches a course doc id
    if (idToKey[old]) {
      const newKey = idToKey[old];
      try {
        await adminDb
          .collection("students")
          .doc(s.id)
          .update({ courseId: newKey });
        counts[newKey] = (counts[newKey] || 0) + 1;
        console.log(`Migrated student ${s.id}: ${old} -> ${newKey}`);
      } catch (e) {
        console.error("Failed to update student", s.id, e);
      }
    } else if (keyToId[old]) {
      // already a key
      counts[old] = (counts[old] || 0) + 1;
    } else {
      // unknown value: try to detect if it's already a courseKey by checking course docs
      const q = await adminDb
        .collection("courses")
        .where("courseKey", "==", old)
        .limit(1)
        .get();
      if (!q.empty) {
        counts[old] = (counts[old] || 0) + 1;
      } else {
        console.warn(`Student ${s.id} has unknown courseId value: ${old}`);
      }
    }
  }

  // 4) Write back counts
  for (const [key, cnt] of Object.entries(counts)) {
    const courseDocId = keyToId[key];
    if (!courseDocId) {
      // try to find by courseKey
      const q = await adminDb
        .collection("courses")
        .where("courseKey", "==", key)
        .limit(1)
        .get();
      if (!q.empty) {
        await adminDb
          .collection("courses")
          .doc(q.docs[0].id)
          .update({ students: cnt });
        console.log(`Updated students=${cnt} for courseKey=${key}`);
      } else {
        console.warn(`No course document found for courseKey=${key}`);
      }
    } else {
      await adminDb
        .collection("courses")
        .doc(courseDocId)
        .update({ students: cnt });
      console.log(
        `Updated students=${cnt} for course ${courseDocId} (key=${key})`
      );
    }
  }

  console.log("Migration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
