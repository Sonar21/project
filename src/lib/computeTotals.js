// computeTotals - canonicalize tuition/paid/percent calculation across views
export function toNumberSafe(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/[^0-9.-]+/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

export function sumPayments(payments) {
  if (!payments) return 0;
  if (Array.isArray(payments)) {
    return payments.reduce((s, p) => s + toNumberSafe(p.amount || p), 0);
  }
  if (typeof payments === "object") {
    return toNumberSafe(payments.totalPaid || payments.paid || 0);
  }
  return toNumberSafe(payments);
}

export function computeTotals({
  student = {},
  courseInfo = null,
  schedulesEntry = null,
  payments = null, // either array of payment objects or { totalPaid }
  fallbackTotal = 0,
}) {
  // Prefer schedule total (per-student paymentSchedules) if available
  const scheduleTotal = toNumberSafe(schedulesEntry?.totalDue || 0);

  // courseInfo may contain pricePerMonth or totalFee/fee/tuition
  const courseTotal = toNumberSafe(
    courseInfo?.totalFee ??
      courseInfo?.fee ??
      courseInfo?.tuition ??
      courseInfo?.pricePerMonth ??
      0
  );

  const studentTotalField = toNumberSafe(
    student?.totalFee ?? student?.totalFees ?? 0
  );

  let baseTotal = 0;
  if (scheduleTotal > 0) baseTotal = scheduleTotal;
  else if (courseTotal > 0) baseTotal = courseTotal;
  else if (studentTotalField > 0) baseTotal = studentTotalField;
  else baseTotal = toNumberSafe(fallbackTotal || 0);

  const discount = toNumberSafe(student?.discount || 0);
  const effectiveTotal = Math.max(baseTotal - discount, 0) || baseTotal || 0;

  const paidTotal =
    sumPayments(payments) || toNumberSafe(student?.paidAmount || 0);

  const percent =
    effectiveTotal > 0
      ? Number(((paidTotal / effectiveTotal) * 100).toFixed(1))
      : 0;

  return {
    baseTotal,
    discount,
    effectiveTotal,
    paid: paidTotal,
    percent,
  };
}

export default computeTotals;
