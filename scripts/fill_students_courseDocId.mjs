// import admin from "firebase-admin";
// import fs from "fs";

// // Usage:
// // 1) Set env var SERVICE_ACCOUNT or pass path as first arg:
// //    $env:SERVICE_ACCOUNT = 'C:/path/to/serviceAccount.json'
// //    node scripts/fill_students_courseDocId.mjs
// // Or:
// //    node scripts/fill_students_courseDocId.mjs C:/path/to/serviceAccount.json
// // The script will:
// // - load all courses into memory
// // - scan all students
// // - for students missing courseDocId, try to find matching course by (courseKey, grade/year)
// // - if found, update student with courseDocId and courseKey

// const saPath = process.env.SERVICE_ACCOUNT || process.argv[2];
// if (!saPath) {
//   console.error(
//     "Missing service account JSON. Set SERVICE_ACCOUNT env or pass path as arg."
//   );
//   process.exit(1);
// }

// if (!fs.existsSync(saPath)) {
//   console.error("Service account file not found:", saPath);
//   process.exit(1);
// }

// const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore();

// async function main() {
//   console.log("Loading courses...");
//   const coursesSnap = await db.collection("courses").get();
//   const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

//   // Build maps
//   const byKeyAndYear = new Map(); // key: `${courseKey}||${year}` -> courseDoc
//   const byKey = new Map(); // key: courseKey -> [courseDocs]

//   for (const c of courses) {
//     const key = String(c.courseKey || "").trim();
//     const year = String(c.year || "").trim();
//     if (!key) continue;
//     byKeyAndYear.set(`${key}||${year}`, c);
//     if (!byKey.has(key)) byKey.set(key, []);
//     byKey.get(key).push(c);
//   }

//   console.log(
//     `Loaded ${courses.length} courses, ${byKey.size} unique courseKeys`
//   );

//   console.log("Scanning students...");
//   const studentsSnap = await db.collection("students").get();
//   const students = studentsSnap.docs.map((d) => ({
//     id: d.id,
//     ref: d.ref,
//     ...d.data(),
//   }));
//   console.log(`Found ${students.length} students`);

//   let updated = 0;
//   const failures = [];

//   for (const s of students) {
//     if (s.courseDocId) continue; // already has it

//     // Determine candidate courseKey
//     const studentCourseKey = (s.courseId || s.courseKey || "")
//       .toString()
//       .trim();
//     const studentGrade = (s.grade || s.gradeJP || "").toString().trim(); // e.g. '1st Year'

//     let matched = null;

//     if (studentCourseKey && studentGrade) {
//       matched =
//         byKeyAndYear.get(`${studentCourseKey}||${studentGrade}`) || null;
//     }

//     if (!matched && studentCourseKey) {
//       const list = byKey.get(studentCourseKey) || [];
//       if (list.length === 1) matched = list[0];
//       else if (list.length > 1) {
//         // prefer exact year match if student's grade contains year words
//         matched =
//           list.find((c) => String(c.year || "").trim() === studentGrade) ||
//           null;
//         if (!matched) matched = list[0]; // fallback to first
//       }
//     }

//     if (!matched) {
//       // last resort: try to find by name heuristics (contains "web" etc.)
//       const nameLower = (s.courseName || "" + s.name || "").toLowerCase();
//       matched = courses.find((c) => {
//         const ck = (c.courseKey || "").toString().toLowerCase();
//         return ck && nameLower.includes(ck);
//       });
//     }

//     if (matched) {
//       try {
//         await s.ref.update({
//           courseDocId: matched.id,
//           courseKey: matched.courseKey || null,
//         });
//         updated++;
//         if (updated % 50 === 0) console.log(`Updated ${updated} students...`);
//       } catch (e) {
//         failures.push({ studentId: s.id, error: e.message });
//       }
//     } else {
//       failures.push({ studentId: s.id, reason: "no match" });
//     }
//   }

//   console.log(
//     `Done. Updated ${updated} students. Failures: ${failures.length}`
//   );
//   if (failures.length)
//     console.log(JSON.stringify(failures.slice(0, 10), null, 2));
// }

// main()
//   .then(() => process.exit(0))
//   .catch((err) => {
//     console.error(err);
//     process.exit(1);
//   });
