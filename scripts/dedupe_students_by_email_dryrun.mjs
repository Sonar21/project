import adminApp, { adminDb } from "../src/firebase/adminApp.js";

async function main() {
  console.log(
    "DRY-RUN: scanning students for email-based doc IDs (no writes will be performed)",
  );

  const studentsSnap = await adminDb.collection("students").get();
  let wouldMove = 0;
  let wouldMerge = 0;
  let wouldSkip = 0;
  const samples = [];

  for (const doc of studentsSnap.docs) {
    const id = doc.id;
    if (!id.includes("@")) continue; // skip normal ones

    const data = doc.data();
    const local = id.split("@")[0];
    const targetRef = adminDb.collection("students").doc(local);
    try {
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        wouldMove++;
        if (samples.length < 20) {
          samples.push({ action: "move", from: id, to: local, data });
        }
      } else {
        // determine if merge would change anything
        const existing = targetSnap.data() || {};
        let changes = {};
        for (const k of Object.keys(data)) {
          const existingVal = existing[k];
          const newVal = data[k];
          if (
            (existingVal === undefined ||
              existingVal === null ||
              existingVal === "") &&
            newVal !== undefined &&
            newVal !== null &&
            newVal !== ""
          ) {
            changes[k] = { from: newVal, to: existingVal };
          }
        }
        if (Object.keys(changes).length > 0) {
          wouldMerge++;
          if (samples.length < 20) {
            samples.push({ action: "merge", from: id, to: local, changes });
          }
        } else {
          wouldSkip++;
          if (samples.length < 20) {
            samples.push({ action: "noop", from: id, to: local });
          }
        }
      }
    } catch (e) {
      console.error(`Error checking ${id}:`, e.message || e);
    }
  }

  console.log("\nDRY-RUN summary:");
  console.log(`  student docs scanned: ${studentsSnap.size}`);
  console.log(`  would move (no target exists): ${wouldMove}`);
  console.log(`  would merge (target exists, some new fields): ${wouldMerge}`);
  console.log(`  would skip (target exists, no new info): ${wouldSkip}`);

  if (samples.length) {
    console.log("\nSample actions (up to 20):");
    for (const s of samples) {
      console.log(JSON.stringify(s, null, 2));
    }
  }

  console.log("\nDRY-RUN complete. No writes performed.");
}

main().catch((e) => {
  console.error("Dry-run failed:", e);
  process.exit(1);
});
