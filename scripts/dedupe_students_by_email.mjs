// import adminApp, { adminDb } from "../src/firebase/adminApp.js";

// async function main() {
//   console.log("Starting dedupe of students with email-based doc IDs...");
//   const studentsSnap = await adminDb.collection("students").get();
//   let moved = 0;
//   let merged = 0;
//   let deleted = 0;
//   const errors = [];

//   for (const doc of studentsSnap.docs) {
//     const id = doc.id;
//     if (!id.includes("@")) continue; // skip normal ones

//     const data = doc.data();
//     const local = id.split("@")[0];
//     const targetRef = adminDb.collection("students").doc(local);
//     try {
//       const targetSnap = await targetRef.get();
//       if (!targetSnap.exists) {
//         // simply copy to new doc id
//         await targetRef.set({ ...data });
//         await adminDb.collection("students").doc(id).delete();
//         moved++;
//         console.log(`Moved ${id} -> ${local}`);
//       } else {
//         // merge: keep existing fields where present, else from email-doc
//         const existing = targetSnap.data() || {};
//         const mergedData = { ...data, ...existing };
//         // prefer existing non-empty values over email-doc's values
//         for (const k of Object.keys(mergedData)) {
//           if (
//             existing[k] !== undefined &&
//             existing[k] !== null &&
//             existing[k] !== ""
//           ) {
//             mergedData[k] = existing[k];
//           } else if (data[k] !== undefined) {
//             mergedData[k] = data[k];
//           }
//         }
//         await targetRef.set(mergedData, { merge: true });
//         await adminDb.collection("students").doc(id).delete();
//         merged++;
//         console.log(`Merged ${id} -> ${local}`);
//       }
//     } catch (e) {
//       errors.push({ id, error: e.message });
//       console.error(`Failed to handle ${id}:`, e);
//     }
//   }

//   console.log(`Done. moved=${moved} merged=${merged} errors=${errors.length}`);
//   if (errors.length) console.log(errors.slice(0, 10));
// }

// main()
//   .then(() => process.exit(0))
//   .catch((e) => {
//     console.error("Dedupe failed:", e);
//     process.exit(1);
//   });
