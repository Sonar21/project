"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";

/**
 * ReceiptBase64Upload
 * Props:
 * - studentId: string (required)
 * - initialMonth: string (optional) e.g. "2025-02"
 *
 * Behavior:
 * 1) Select an image file -> convert to Base64 (data URL)
 * 2) Save a payment document into `payments` collection with these fields:
 *    { amount, month, studentId, status, uploadedAt, verifiedByTeacher, receiptBase64 }
 * 3) Subscribe to payments for the student and display any receiptBase64 images
 */
export default function ReceiptBase64Upload({ studentId, initialMonth }) {
  const [file, setFile] = useState(null);
  const [base64, setBase64] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(initialMonth || "");
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;
    const paymentsRef = collection(db, "payments");
    const q = query(
      paymentsRef,
      where("studentId", "==", studentId),
      orderBy("uploadedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPayments(data);
      },
      (err) => {
        console.error("payments snapshot error:", err);
      }
    );
    return () => unsub();
  }, [studentId]);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e) => {
    setError("");
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    setFile(f);
    try {
      const b = await toBase64(f);
      setBase64(b);
    } catch (err) {
      console.error("Base64 convert error:", err);
      setError("画像の読み込みに失敗しました");
    }
  };

  const handleSave = async () => {
    if (!studentId) {
      setError("studentId が必要です");
      return;
    }
    const numAmount = Number(amount || 0);
    if (!numAmount || Number.isNaN(numAmount) || numAmount <= 0) {
      setError("有効な金額を入力してください（数値）");
      return;
    }
    if (!base64) {
      setError("画像を選択してください");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const paymentsRef = collection(db, "payments");
      const payload = {
        amount: numAmount,
        month: month || new Date().toISOString().slice(0, 7), // YYYY-MM
        studentId,
        status: "未払い",
        uploadedAt: serverTimestamp(),
        verifiedByTeacher: false,
        receiptBase64: base64,
      };
      const docRef = await addDoc(paymentsRef, payload);
      // Optionally set paymentId field to the auto-id (not required but often handy)
      // Note: This requires an additional write; skip if not desired.
      // await updateDoc(doc(db, 'payments', docRef.id), { paymentId: docRef.id });
      setFile(null);
      setBase64("");
      setAmount("");
      setMonth(initialMonth || "");
      // payments listener will reflect the new doc automatically
    } catch (err) {
      console.error("save error:", err);
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "1px dashed #ddd",
        padding: 12,
        borderRadius: 6,
        maxWidth: 720,
      }}
    >
      <h4>レシート（Base64）アップロード</h4>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label>
          金額:
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginLeft: 6 }}
          />
        </label>
        <label>
          支払い月:
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ marginLeft: 6 }}
          />
        </label>
        <label>
          画像:
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ marginLeft: 6 }}
          />
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ marginLeft: 6 }}
        >
          {saving ? "保存中..." : "保存（Base64で保存）"}
        </button>
      </div>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 12 }}>
        <strong>プレビュー</strong>
        <div style={{ marginTop: 8 }}>
          {base64 ? (
            <img
              src={base64}
              alt="preview"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          ) : (
            <div style={{ color: "#666" }}>
              画像を選択するとここにプレビューされます
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>保存済みレシート（この学生）</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
            gap: 12,
            marginTop: 10,
          }}
        >
          {payments.length === 0 && (
            <div style={{ color: "#666" }}>まだレシートがありません</div>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              style={{ border: "1px solid #eee", padding: 8, borderRadius: 6 }}
            >
              <div style={{ fontSize: 12, color: "#333" }}>
                金額: ¥{Number(p.amount).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>月: {p.month}</div>
              <div style={{ marginTop: 8 }}>
                {p.receiptBase64 ? (
                  // receiptBase64 is a data URL, safe to use as src
                  <img
                    src={p.receiptBase64}
                    alt={`receipt-${p.id}`}
                    style={{ width: "100%", height: "auto" }}
                  />
                ) : (
                  <div style={{ color: "#999" }}>画像なし</div>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                状態: {p.status || "-"}{" "}
                {p.verifiedByTeacher ? "(承認済み)" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
