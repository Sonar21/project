/**
 * computeMigrationPlan
 *
 * Pure function that computes a migration plan to move remaining unpaid amount
 * from `fromYear` to `toYear` across a set of payment months.
 *
 * Parameters:
 * - docs: Array of payment schedule documents. Each doc can have fields:
 *     - month: string like "2024-02" or id like "2024-02"
 *     - dueAmount: number
 *     - paidAmount: number
 *     - id: optional, used to match `${year}-${mm}`
 *   The function will read values from these docs for both years.
 * - fromYear: number (e.g. 2024)
 * - toYear: number (e.g. 2025)
 * - paymentMonths: array of month strings ("02","03",...)
 * - courseTemplate: object with optional fields:
 *     - monthlyTemplate: { "02": num, ... }
 *     - pricePerMonth: number
 *     - paymentMonths: fallback months array
 *
 * Return value shape:
 * {
 *   migrated: boolean,
 *   addedAmount: number, // remaining from fromYear
 *   newTotalYear2: number,
 *   changes: [{ month, before, after, created }],
 *   reason?: string,
 *   preview?: { months: { mm: { before, after, paid } }, lockedTotal, adjustableTotal }
 * }
 */

export function computeMigrationPlan(
  docs = [],
  fromYear,
  toYear,
  paymentMonths,
  courseTemplate = {}
) {
  // Normalize month list
  const defaultMonths = ["02", "03", "04", "05", "06", "07", "08", "09", "10"];
  const months = Array.isArray(paymentMonths)
    ? paymentMonths.slice()
    : Array.isArray(courseTemplate.paymentMonths)
    ? courseTemplate.paymentMonths.slice()
    : defaultMonths.slice();

  const monthlyTemplate =
    (courseTemplate && courseTemplate.monthlyTemplate) || {};
  const pricePerMonth =
    courseTemplate && typeof courseTemplate.pricePerMonth !== "undefined"
      ? Number(courseTemplate.pricePerMonth) || 0
      : null;

  // helper to get year and month from doc
  function docYearAndMonth(doc) {
    if (!doc) return {};
    if (doc.month && typeof doc.month === "string") {
      // accept formats like "2024-02" or id like "2024-02"
      const parts = doc.month.split("-");
      if (parts.length >= 2) {
        const y = Number(parts[0]);
        const mm = parts[1];
        if (!Number.isNaN(y) && typeof mm === "string") return { year: y, mm };
      }
    }
    // fallback: maybe doc has explicit year/month fields
    if (typeof doc.year !== "undefined" && typeof doc.month === "string") {
      return { year: Number(doc.year), mm: doc.month };
    }
    return {};
  }

  // Partition docs by year
  const year1Docs = [];
  const year2Docs = [];
  for (const d of docs) {
    const { year, mm } = docYearAndMonth(d);
    if (year === Number(fromYear)) year1Docs.push({ ...d, year, mm });
    if (year === Number(toYear)) year2Docs.push({ ...d, year, mm });
  }

  // Sum remaining of fromYear
  let remainingYear1 = 0;
  for (const d of year1Docs) {
    const due = Number(d.dueAmount || 0);
    const paid = Number(d.paidAmount || 0);
    remainingYear1 += Math.max(0, due - paid);
  }
  remainingYear1 = Math.round(remainingYear1);

  const existingTotalYear2 = year2Docs.reduce(
    (s, d) => s + (Number(d.dueAmount) || 0),
    0
  );
  const newTotalYear2 = Math.round(existingTotalYear2 + remainingYear1);

  if (remainingYear1 <= 0) {
    return {
      migrated: false,
      addedAmount: 0,
      newTotalYear2: existingTotalYear2,
      changes: [],
      reason: "no remaining balance for fromYear",
    };
  }

  // Build base info for each target month
  const monthInfos = months.map((mm) => {
    // find existing document by id pattern or by mm
    let existing = year2Docs.find(
      (d) =>
        d.id === `${toYear}-${mm}` ||
        d.month === `${toYear}-${mm}` ||
        d.mm === mm
    );
    const existingDue = existing ? Number(existing.dueAmount || 0) : null;
    const existingPaid = existing ? Number(existing.paidAmount || 0) : 0;

    const tplVal =
      typeof monthlyTemplate[mm] !== "undefined"
        ? Number(monthlyTemplate[mm] || 0)
        : null;

    const base =
      existingDue !== null
        ? existingDue
        : tplVal !== null
        ? tplVal
        : pricePerMonth !== null
        ? Math.round(pricePerMonth)
        : 0;

    const locked = existingPaid > 0;
    const lockedAmount = locked ? Math.max(base, existingPaid) : 0;

    return {
      mm,
      existing,
      before: existingDue !== null ? existingDue : null,
      paid: existingPaid,
      base: Math.round(base),
      locked,
      lockedAmount: Math.round(lockedAmount),
      after: null,
      created: !existing,
    };
  });

  const lockedTotal = monthInfos.reduce(
    (s, m) => s + (m.locked ? m.lockedAmount : 0),
    0
  );
  const adjustableMonths = monthInfos.filter((m) => !m.locked);
  const adjustableBaseSum = adjustableMonths.reduce((s, m) => s + m.base, 0);

  // If locked total itself exceeds newTotalYear2, cannot satisfy requirement
  if (lockedTotal > newTotalYear2) {
    // Build preview showing locked preserved, adjustable zeroed
    const changes = monthInfos.map((m) => ({
      month: m.mm,
      before: m.before,
      after: m.locked ? m.lockedAmount : 0,
      created: m.created,
    }));
    return {
      migrated: false,
      addedAmount: remainingYear1,
      newTotalYear2,
      changes,
      reason:
        "locked months sum exceeds target total; cannot reduce locked months below paidAmount",
      preview: {
        lockedTotal,
        adjustableBaseSum,
      },
    };
  }

  // Amount available for adjustable months
  const remainingForAdjust = newTotalYear2 - lockedTotal;

  // If no adjustable months, remainingForAdjust must equal 0 (otherwise nothing to allocate)
  if (adjustableMonths.length === 0) {
    if (remainingForAdjust !== 0) {
      const changes = monthInfos.map((m) => ({
        month: m.mm,
        before: m.before,
        after: m.lockedAmount || m.base,
        created: m.created,
      }));
      return {
        migrated: false,
        addedAmount: remainingYear1,
        newTotalYear2,
        changes,
        reason: "no adjustable months to distribute adjustment",
        preview: { lockedTotal, adjustableBaseSum },
      };
    }
    // nothing to change
    return {
      migrated: false,
      addedAmount: remainingYear1,
      newTotalYear2,
      changes: [],
      reason: "no adjustable months and no adjustment needed",
    };
  }

  // Compute extra to distribute relative to adjustable bases
  const extraToDistribute = remainingForAdjust - adjustableBaseSum;
  const N = adjustableMonths.length;
  // integer division with remainder distribution starting from the first month
  const share = Math.trunc(extraToDistribute / N); // can be negative
  let rem = extraToDistribute - share * N; // remainder, may be positive or negative

  // Apply finals
  for (let i = 0; i < monthInfos.length; i++) {
    const m = monthInfos[i];
    if (m.locked) {
      m.after = m.lockedAmount;
      continue;
    }
    // determine index among adjustable months
    const adjIndex = adjustableMonths.findIndex((x) => x.mm === m.mm);
    let add = share;
    if (rem > 0) {
      // distribute +1 to the earliest rem months
      if (adjIndex >= 0 && adjIndex < rem) add += 1;
    } else if (rem < 0) {
      // distribute -1 to the earliest |rem| adjustable months
      if (adjIndex >= 0 && adjIndex < Math.abs(rem)) add -= 1;
    }
    m.after = Math.round(Math.max(0, m.base + add));
  }

  // Ensure total matches newTotalYear2 (fix rounding diffs by adjusting earliest adjustable)
  let sumAfter = monthInfos.reduce((s, m) => s + (Number(m.after) || 0), 0);
  let diff = newTotalYear2 - sumAfter;
  if (diff !== 0) {
    // prefer adjusting adjustable months from the start
    const adjustableOrder = monthInfos.filter((m) => !m.locked);
    let j = 0;
    const sign = diff > 0 ? 1 : -1;
    while (diff !== 0 && adjustableOrder.length > 0) {
      const target = adjustableOrder[j % adjustableOrder.length];
      const candidate = Number(target.after) + sign;
      if (candidate >= 0) {
        target.after = candidate;
        diff -= sign;
      }
      j += 1;
      // safety: avoid infinite loop
      if (j > 10000) break;
    }
    // re-compose afters back to monthInfos (they are same objects)
    sumAfter = monthInfos.reduce((s, m) => s + (Number(m.after) || 0), 0);
  }

  // Build changes array
  const changes = monthInfos.map((m) => ({
    month: m.mm,
    before: m.before,
    after: Number(m.after || 0),
    created: m.created,
  }));

  const migrated = changes.some((c) => {
    // if any change from existing due (or creation)
    const beforeVal = c.before === null ? 0 : Number(c.before || 0);
    return beforeVal !== Number(c.after || 0) || c.created;
  });

  return {
    migrated,
    addedAmount: remainingYear1,
    newTotalYear2,
    changes,
    preview: {
      months: monthInfos.reduce((acc, m) => {
        acc[m.mm] = { before: m.before, after: m.after, paid: m.paid };
        return acc;
      }, {}),
      lockedTotal,
      adjustableBaseSum,
    },
  };
}

export default computeMigrationPlan;
