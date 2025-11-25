import {
  collection,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";

/**
 * Migrate unpaid remainder from one year to the next for a student's schedules.
 *
 * Behavior:
 * - Read paymentSchedules for fromYear (months 02-10), sum dueAmount and paidAmount.
 * - Compute remainingYear = totalDueYear - totalPaidYear (if <= 0, nothing to do).
 * - Read paymentSchedules for toYear and compute existing total.
 * - newTotalToYear = existingTotalToYear + remainingYear
 * - Recalculate dueAmount for months Feb..Oct of toYear using the following rules:
 *    - If courseMonthlyTemplate (from course doc) exists, use template values as base and
 *      distribute any difference (newTotal - baseSum) evenly across months.
 *    - Else if coursePricePerMonth exists, use that as base for each month and distribute
 *      any difference evenly.
 *    - Else distribute newTotal evenly across the 9 months.
 * - Update (set/update) each month document with new dueAmount, keep paidAmount unchanged,
 *   and refresh status to one of '未払い' | '一部支払い' | '支払い済み'.
 *
 * Note: This function assumes the course document (if present) is reachable via
 * student.courseDocId (student doc). You can pass courseTemplate optionaly to
 * override fetching course doc.
 */
export async function migrateRemainingToNextYear({
  studentId,
  fromYear,
  toYear,
  courseTemplate = null,
  coursePricePerMonth = null,
} = {}) {
  if (!studentId) throw new Error("studentId required");
  const y1 = Number(fromYear);
  const y2 = typeof toYear !== "undefined" ? Number(toYear) : y1 + 1;

  const schedulesRef = collection(
    db,
    "students",
    studentId,
    "paymentSchedules"
  );
  const snap = await getDocs(schedulesRef);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const year1Docs = docs.filter(
    (d) => typeof d.month === "string" && d.month.startsWith(`${y1}-`)
  );
  const year2Docs = docs.filter(
    (d) => typeof d.month === "string" && d.month.startsWith(`${y2}-`)
  );

  const totalDueYear1 = year1Docs.reduce(
    (s, d) => s + (Number(d.dueAmount) || 0),
    0
  );
  const totalPaidYear1 = year1Docs.reduce(
    (s, d) => s + (Number(d.paidAmount) || 0),
    0
  );
  const remainingYear1 = Math.max(totalDueYear1 - totalPaidYear1, 0);
  if (remainingYear1 <= 0) {
    return { migrated: false, reason: "no remaining balance for fromYear" };
  }

  const existingTotalYear2 = year2Docs.reduce(
    (s, d) => s + (Number(d.dueAmount) || 0),
    0
  );
  const newTotalYear2 = existingTotalYear2 + remainingYear1;

  // Fetch course template data if not provided (best-effort). We try to read
  // student's courseDocId from students/{studentId} document only if courseTemplate
  // wasn't supplied. Caller can provide template to avoid extra reads.
  let monthlyTemplate = {};
  let pricePerMonth = null;
  if (courseTemplate) {
    monthlyTemplate = courseTemplate.monthlyTemplate || {};
    pricePerMonth = courseTemplate.pricePerMonth || null;
  }

  // Build new due amounts for months 02..10 of y2
  const months = [];
  for (let m = 2; m <= 10; m++) months.push(String(m).padStart(2, "0"));

  // Base sums depending on template or price
  const templateVals = months.map((mm) => Number(monthlyTemplate[mm] || 0));
  const templateSum = templateVals.reduce((s, v) => s + v, 0);

  let desiredPerMonth = {};
  if (templateSum > 0) {
    // Use template and distribute adjustment evenly
    let adjustment = newTotalYear2 - templateSum;
    const baseAdd = Math.floor(adjustment / months.length);
    let rem = adjustment - baseAdd * months.length;
    for (const mm of months) {
      const base = Number(monthlyTemplate[mm] || 0);
      let add = baseAdd;
      if (rem > 0) {
        add += 1;
        rem -= 1;
      }
      desiredPerMonth[mm] = Math.max(0, base + add);
    }
  } else if (pricePerMonth != null) {
    const base = Math.round(Number(pricePerMonth) || 0);
    const baseSum = base * months.length;
    let adjustment = newTotalYear2 - baseSum;
    const baseAdd = Math.floor(adjustment / months.length);
    let rem = adjustment - baseAdd * months.length;
    for (const mm of months) {
      let val = base + baseAdd;
      if (rem > 0) {
        val += 1;
        rem -= 1;
      }
      desiredPerMonth[mm] = Math.max(0, val);
    }
  } else {
    // distribute evenly
    const base = Math.floor(newTotalYear2 / months.length);
    let rem = newTotalYear2 - base * months.length;
    for (const mm of months) {
      let val = base;
      if (rem > 0) {
        val += 1;
        rem -= 1;
      }
      desiredPerMonth[mm] = Math.max(0, val);
    }
  }

  // Apply updates to year2 docs (create if missing)
  const ops = [];
  for (const mm of months) {
    const id = `${y2}-${mm}`;
    const due = desiredPerMonth[mm] || 0;
    const existing = year2Docs.find((d) => d.id === id);
    const paid = Number(existing?.paidAmount || 0);
    let status = "未払い";
    if (paid <= 0) status = "未払い";
    else if (paid >= due) status = "支払い済み";
    else status = "一部支払い";

    const ref = doc(schedulesRef, id);
    const payload = {
      month: id,
      dueDate: new Date(y2, Number(mm), 0).toISOString().slice(0, 10),
      dueAmount: due,
      paidAmount: paid,
      status,
      updatedAt: serverTimestamp(),
    };

    if (existing) {
      ops.push(updateDoc(ref, payload).catch((e) => ({ error: e, id })));
    } else {
      // ensure createdAt when creating
      payload.createdAt = serverTimestamp();
      ops.push(setDoc(ref, payload).catch((e) => ({ error: e, id })));
    }
  }

  await Promise.all(ops);

  return {
    migrated: true,
    fromYear: y1,
    toYear: y2,
    addedAmount: remainingYear1,
    newTotalYear2,
  };
}

export default migrateRemainingToNextYear;
