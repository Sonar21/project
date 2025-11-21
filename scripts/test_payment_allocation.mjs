// Quick test for allocation logic used in PaymentSchedule.jsx
const payments = [
  {
    id: "p1",
    amount: 300000,
    receiptUrl: "http://example.com/1",
    createdAt: new Date("2025-02-10"),
  },
];

const schedules = [
  { month: "2025-02", dueAmount: 86000 },
  { month: "2025-03", dueAmount: 86000 },
  { month: "2025-04", dueAmount: 86000 },
  { month: "2025-05", dueAmount: 86000 },
  { month: "2025-06", dueAmount: 86000 },
  { month: "2025-07", dueAmount: 86000 },
];

function allocate(payments, schedules) {
  const paymentEntries = (payments || [])
    .map((p) => ({
      id: p.id || p.receiptUrl || Math.random().toString(36).slice(2),
      amount: Number(p.amount) || 0,
      receiptUrl: p.receiptUrl || p.receiptBase64 || null,
      createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(),
      original: p,
      remaining: Number(p.amount) || 0,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);

  const allocation = {};
  for (const s of schedules) {
    const monthId = s.month;
    const due = Number(s.dueAmount) || 0;
    let allocated = 0;
    const related = [];
    while (due - allocated > 0 && paymentEntries.length > 0) {
      const head = paymentEntries[0];
      if (!head || head.remaining <= 0) {
        paymentEntries.shift();
        continue;
      }
      const need = due - allocated;
      const take = Math.min(need, head.remaining);
      allocated += take;
      head.remaining -= take;
      related.push({ ...head.original, _appliedAmount: take });
      if (head.remaining <= 0) paymentEntries.shift();
    }
    let status = "未払い";
    if (allocated <= 0) status = "未払い";
    else if (allocated >= due) status = "支払い済み";
    else status = "一部支払い";
    allocation[monthId] = { paid: allocated, status, relatedPayments: related };
  }
  return allocation;
}

const result = allocate(payments, schedules);
console.log(JSON.stringify(result, null, 2));
