#!/usr/bin/env node
/**
 * scripts/recompute_student_grades.mjs
 *
 * Usage:
 *   # dry run for specific ids
 *   node scripts/recompute_student_grades.mjs --ids=w24001,w24002 --dry
 *
 *   # update specified ids
 *   node scripts/recompute_student_grades.mjs --ids=w24001,w24002
 *
 *   # update all students (CAREFUL)
 *   node scripts/recompute_student_grades.mjs --all
 *
 * This script initializes firebase-admin using either FIREBASE_SERVICE_ACCOUNT
 * (JSON string) or GOOGLE_APPLICATION_CREDENTIALS path and recalculates
 * gradeJP/gradeEN/entranceYear based on the April-March academic year.
 */
import admin from "firebase-admin";
import fs from "fs";

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=");
      args[k] = v === undefined ? true : v;
    }
  }
  return args;
}

function getAcademicYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1;
  return month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

function getGradeInfo(entranceYear, date = new Date()) {
  const academicYear = getAcademicYear(date);
  if (!Number.isFinite(entranceYear)) {
    return { academicYear, gradeNum: null, gradeJP: null, gradeEN: null };
  }
  const gradeNum = academicYear - entranceYear + 1;
  const gradeMapJP = { 1: "1年生", 2: "2年生", 3: "3年生", 4: "4年生" };
  const gradeJP = gradeMapJP[gradeNum] || `${gradeNum}年生`;
  const ordinal = (n) => {
    if (!Number.isFinite(n)) return `${n}`;
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  };
  const gradeEN = `${ordinal(gradeNum)} Year`;
  return { academicYear, gradeNum, gradeJP, gradeEN };
}

async function initAdmin() {
  // Prefer FIREBASE_SERVICE_ACCOUNT (JSON string), then GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    // Rely on ADC if GOOGLE_APPLICATION_CREDENTIALS is set in env
    admin.initializeApp();
  }
  return admin.firestore();
}

async function main() {
  const args = parseArgs();
  const dry = args.dry || args.dryrun || args.dry === "true";
  const ids = args.ids
    ? String(args.ids)
        .split(",")
        .map((s) => s.trim())
    : null;
  const all = args.all || false;

  if (!ids && !all) {
    console.error("Specify --ids=id1,id2 or --all");
    process.exit(1);
  }

  const db = await initAdmin();

  let q;
  if (ids) {
    // fetch by document id directly
    const docs = [];
    for (const id of ids) {
      const ref = db.collection("students").doc(id);
      const snap = await ref.get();
      if (snap.exists) docs.push(snap);
      else console.warn("student not found:", id);
    }

    for (const snap of docs) {
      await processStudentDoc(snap, db, dry);
    }
  } else if (all) {
    q = db.collection("students");
    const snap = await q.get();
    for (const docSnap of snap.docs) {
      await processStudentDoc(docSnap, db, dry);
    }
  }

  console.log(dry ? "Dry run complete" : "Update complete");
  process.exit(0);
}

async function processStudentDoc(snap, db, dry) {
  const id = snap.id;
  const data = snap.data() || {};
  const today = new Date();

  // derive entranceYear: prefer stored, else parse from studentId
  let entranceYear = data.entranceYear;
  if (!Number.isFinite(entranceYear)) {
    const parsedYearCode = parseInt(
      String(data.studentId || id).slice(1, 3),
      10
    );
    let parsed = 2000 + (Number.isFinite(parsedYearCode) ? parsedYearCode : 0);
    const academicYear = getAcademicYear(today);
    if (parsed > academicYear) parsed -= 100;
    entranceYear = parsed;
  }

  const g = getGradeInfo(entranceYear, today);

  const updates = {};
  if (data.entranceYear !== entranceYear) updates.entranceYear = entranceYear;
  if (data.gradeJP !== g.gradeJP) updates.gradeJP = g.gradeJP;
  if (data.grade !== g.gradeEN) updates.grade = g.gradeEN;
  if (data.gradeEN !== g.gradeEN) updates.gradeEN = g.gradeEN;

  if (Object.keys(updates).length === 0) {
    console.log(id, "no-change ->", g.gradeJP);
    return;
  }

  console.log("\n---");
  console.log("doc:", id);
  console.log("before:", {
    entranceYear: data.entranceYear,
    gradeJP: data.gradeJP,
    gradeEN: data.gradeEN,
    grade: data.grade,
  });
  console.log("after:", {
    entranceYear,
    gradeJP: g.gradeJP,
    gradeEN: g.gradeEN,
    grade: g.gradeEN,
  });

  if (dry) return;

  try {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("students").doc(id).update(updates);
    console.log("updated", id);
  } catch (e) {
    console.error("update failed for", id, e);
  }
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
