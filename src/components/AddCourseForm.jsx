"use client";

import React, { useState } from "react";
import { db } from "@/firebase/clientApp";
import {
  collection,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

export default function AddCourseForm() {
  const [name, setName] = useState("");
  const [nameJa, setNameJa] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [courseKey, setCourseKey] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [useKeyAsId, setUseKeyAsId] = useState(false);

  const clearForm = () => {
    setName("");
    setNameJa("");
    setNameEn("");
    setCourseKey("");
    setPricePerMonth("");
    setYear("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!courseKey.trim() || !pricePerMonth) {
      setMessage("必須項目を入力してください（courseKey、月額）。");
      return;
    }

    if (!name.trim() && !nameJa.trim() && !nameEn.trim()) {
      setMessage("コース名を日本語または英語のいずれかで入力してください。");
      return;
    }

    const numeric = Number(String(pricePerMonth).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(numeric)) {
      setMessage("金額は数値で入力してください。");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        // name: fallback display name
        name: name.trim() || nameJa.trim() || nameEn.trim(),
        nameJa: nameJa.trim() || null,
        nameEn: nameEn.trim() || null,
        courseKey: courseKey.trim(),
        pricePerMonth: numeric,
        fee: String(numeric),
        year: year || "",
        students: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (useKeyAsId && courseKey.trim()) {
        // use courseKey as document ID (idempotent: will overwrite existing)
        const keyId = courseKey.trim();
        await setDoc(doc(db, "courses", keyId), payload);
        setMessage(`コースを作成しました（ID = courseKey）: ${keyId}`);
      } else {
        const ref = await addDoc(collection(db, "courses"), payload);
        setMessage(`コースを作成しました。ID: ${ref.id}`);
      }

      clearForm();
    } catch (err) {
      console.error("AddCourseForm - create error:", err);
      setMessage("コース作成中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 8 }}>
        <label>
          コース名
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          コース名（日本語、任意）
          <input
            type="text"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
            placeholder="例: 観光日本語"
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Course name (English, optional)
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g. Tourism Japanese"
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          courseKey
          <input
            type="text"
            value={courseKey}
            onChange={(e) => setCourseKey(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          月額 (pricePerMonth)
          <input
            type="number"
            value={pricePerMonth}
            onChange={(e) => setPricePerMonth(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Year
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="例: 2nd Year"
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={useKeyAsId}
            onChange={(e) => setUseKeyAsId(e.target.checked)}
          />
          courseKey をドキュメントIDとして保存する
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="submit" disabled={saving}>
          {saving ? "作成中..." : "コースを作成"}
        </button>
        <button
          type="button"
          onClick={() => {
            clearForm();
            setMessage("");
          }}
        >
          クリア
        </button>
      </div>

      {message && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          {message}
        </div>
      )}
    </form>
  );
}
