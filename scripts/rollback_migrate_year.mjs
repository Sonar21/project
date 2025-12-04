import admin from "firebase-admin";

// Usage:
// Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.
// node scripts/rollback_migrate_year.mjs <studentId> <fromYear> [toYear]

if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !process.env.FIREBASE_CONFIG
) {
  console.warn(
    "\nWarning: No explicit Firebase credentials found. Make sure the environment has Application Default Credentials or set GOOGLE_APPLICATION_CREDENTIALS."
  );
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

function monthsList() {
  const months = [];
  for (let m = 2; m <= 10; m++) months.push(String(m).padStart(2, "0"));
  return months;
}

async function getStudentDoc(studentId) {
  const ref = db.collection("students").doc(studentId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function getSchedules(studentId) {
  const col = db
    .collection("students")
    .doc(studentId)
    .collection("paymentSchedules");
  const snap = await col.get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

function buildDesiredPerMonth(
  newTotalYear,
  months,
  monthlyTemplate = {},
  pricePerMonth = null
) {
  const templateVals = months.map((mm) => Number(monthlyTemplate[mm] || 0));
  const templateSum = templateVals.reduce((s, v) => s + v, 0);
  const desired = {};
  if (templateSum > 0) {
    let adjustment = newTotalYear - templateSum;
    const baseAdd = Math.floor(adjustment / months.length);
    let rem = adjustment - baseAdd * months.length;
    for (const mm of months) {
      const base = Number(monthlyTemplate[mm] || 0);
      let add = baseAdd;
      if (rem > 0) {
        add += 1;
        rem -= 1;
      }
      desired[mm] = Math.max(0, base + add);
    }
  } else if (pricePerMonth != null) {
    const base = Math.round(Number(pricePerMonth) || 0);
    const baseSum = base * months.length;
    let adjustment = newTotalYear - baseSum;
    const baseAdd = Math.floor(adjustment / months.length);
    let rem = adjustment - baseAdd * months.length;
    for (const mm of months) {
      let val = base + baseAdd;
      if (rem > 0) {
        val += 1;
        rem -= 1;
      }
      desired[mm] = Math.max(0, val);
    }
  } else {
    const base = Math.floor(newTotalYear / months.length);
    let rem = newTotalYear - base * months.length;
    for (const mm of months) {
      let val = base;
      if (rem > 0) {
        val += 1;
        rem -= 1;
      }
      desired[mm] = Math.max(0, val);
    }
  }
  return desired;
}

async function rollback({ studentId, fromYear, toYear }) {
  if (!studentId) throw new Error("studentId required");
  const y1 = Number(fromYear);
  const y2 = typeof toYear !== "undefined" ? Number(toYear) : y1 + 1;
  console.log(
    `Starting rollback for student=${studentId} fromYear=${y1} toYear=${y2}`
  );

  const schedules = await getSchedules(studentId);
  const year1Docs = schedules.filter(
    (d) => typeof d.month === "string" && d.month.startsWith(`${y1}-`)
  );
  const year2Docs = schedules.filter(
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
    console.log("No remaining amount for fromYear; nothing to rollback.");
    return { rolledBack: false, reason: "no_remaining_in_fromYear" };
  }

  const totalDueYear2Current = year2Docs.reduce(
    (s, d) => s + (Number(d.dueAmount) || 0),
    0
  );
  console.log("remainingYear1 (computed):", remainingYear1);
  console.log("current total due for toYear:", totalDueYear2Current);

  const oldTotalYear2 = Math.max(totalDueYear2Current - remainingYear1, 0);
  console.log("target (old) total for toYear after rollback:", oldTotalYear2);

  // fetch student doc to get course template / price
  const studentDoc = await getStudentDoc(studentId);
  let courseTemplate = null;
  let pricePerMonth = null;
  if (studentDoc && studentDoc.courseDocId) {
    try {
      const courseSnap = await db
        .collection("courses")
        .doc(studentDoc.courseDocId)
        .get();
      if (courseSnap.exists) {
        const cd = courseSnap.data() || {};
        courseTemplate = cd.monthlyTemplate || null;
        pricePerMonth = cd.pricePerMonth ?? cd.pricePerMonth;
        console.log("found course doc for template/price", courseSnap.id);
      }
    } catch (e) {
      console.warn("failed to read courseDoc for student:", e.message || e);
    }
  }

  const months = monthsList();
  const desired = buildDesiredPerMonth(
    oldTotalYear2,
    months,
    courseTemplate || {},
    pricePerMonth ?? null
  );

  // Apply updates to year2 docs: set dueAmount to desired, keep paidAmount unchanged
  const ops = [];
  for (const mm of months) {
    const id = `${y2}-${mm}`;
    const due = Number(desired[mm] || 0);
    const existing = year2Docs.find((d) => d.id === id);
    const paid = Number(existing?.paidAmount || 0);
    let status = "未払い";
    if (paid <= 0) status = "未払い";
    else if (paid >= due) status = "支払い済み";
    else status = "一部支払い";

    const ref = db
      .collection("students")
      .doc(studentId)
      .collection("paymentSchedules")
      .doc(id);
    const payload = {
      month: id,
      dueDate: new Date(y2, Number(mm), 0).toISOString().slice(0, 10),
      dueAmount: due,
      paidAmount: paid,
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (existing) {
      ops.push(ref.update(payload));
    } else {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      ops.push(ref.set(payload));
    }
  }

  await Promise.all(ops.map((p) => p.catch((e) => ({ error: e }))));
  console.log(
    `Rollback applied: subtracted ${remainingYear1} from toYear schedules (set to distribution based on ${
      courseTemplate
        ? "template"
        : pricePerMonth != null
        ? "pricePerMonth"
        : "even distribution"
    }).`
  );

  return {
    rolledBack: true,
    subtractedAmount: remainingYear1,
    toYear: y2,
    newTotalYear2: oldTotalYear2,
  };
}

async function main() {
  const studentId = process.argv[2];
  const fromYear = process.argv[3];
  const toYear = process.argv[4];
  if (!studentId || !fromYear) {
    console.error(
      "Usage: node scripts/rollback_migrate_year.mjs <studentId> <fromYear> [toYear]"
    );
    process.exit(1);
  }
  try {
    const res = await rollback({ studentId, fromYear, toYear });
    console.log("Result:", res);
    process.exit(0);
  } catch (err) {
    console.error("Rollback failed:", err);
    process.exit(2);
  }
}

main();
