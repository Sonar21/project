#!/usr/bin/env node
import admin, { adminDb } from "../src/firebase/adminApp.js";
import { getGradeInfo } from "../src/lib/academicYear.js";

// Mapping of studentId -> correct entrance year
const defaultFixes = {
  // 修正対象をここに追加
  W24001: 2024,
};

async function run() {
  const ids = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(defaultFixes);

  if (!ids.length) {
    console.error("No student ids provided and no defaults configured.");
    process.exit(1);
  }

  const today = new Date();

  for (const id of ids) {
    try {
      const docRef = adminDb.collection("students").doc(String(id));
      const snap = await docRef.get();
      if (!snap.exists) {
        console.warn(`[fix] student not found: ${id}`);
        continue;
      }

      const desiredEntranceYear = defaultFixes[id] || null;
      if (!desiredEntranceYear) {
        console.warn(`[fix] no desired entrance year configured for ${id}`);
        continue;
      }

      const { gradeJP, gradeEN } = getGradeInfo(desiredEntranceYear, today);

      await docRef.update({
        entranceYear: desiredEntranceYear,
        grade: gradeEN,
        gradeJP,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[fix] updated ${id} -> entranceYear ${desiredEntranceYear}, ${gradeJP} / ${gradeEN}`
      );
    } catch (err) {
      console.error(`[fix] failed for ${id}:`, err);
    }
  }

  process.exit(0);
}

run();
