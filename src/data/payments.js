// In-memory payments store for demo
const payments = new Map();

// seed: studentId -> paid (number)
payments.set("w24002", 320000);

export function getPaidForStudent(studentId) {
  if (!studentId) return 0;
  return payments.get(String(studentId).toLowerCase()) || 0;
}

export function setPaidForStudent(studentId, amount) {
  const key = String(studentId).toLowerCase();
  const n = Number(amount) || 0;
  payments.set(key, n);
  return n;
}

export function listPayments() {
  return Array.from(payments.entries()).map(([studentId, paid]) => ({
    studentId,
    paid,
  }));
}
