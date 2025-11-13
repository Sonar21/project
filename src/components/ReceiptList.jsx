"use client";

import React, { useState, useEffect } from "react";
import styles from "./ReceiptList.module.css";
// import Img from "next.image";

// payments: array of { id, amount, receiptUrl, receiptBase64, createdAt }
export default function ReceiptList({ payments = [] }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!payments || payments.length === 0) return <span>-</span>;

  const open = (src) => setSelected(src);
  const close = () => setSelected(null);

  return (
    <>
      <div className={styles.container}>
        {payments.map((p) => {
          const src = p.receiptBase64 || p.receiptUrl || null;
          return (
            <div key={p.id || p.receiptUrl || Math.random()} className={styles.item}>
              {src ? (
                <img
                  src={src}
                  alt={`receipt-${p.id || "img"}`}
                  className={styles.thumb}
                  onClick={() => open(src)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open(src);
                  }}
                />
              ) : (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderText}>No image</span>
                </div>
              )}
              {/* <div className={styles.meta}>
                <div className={styles.receiptMeta}>月: {p.month || "-"}</div>
                <div className={styles.receiptSub}>金額: {p.amount ?? "-"}</div>
              </div> */}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className={styles.modal} onClick={close} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={close} aria-label="閉じる">
              ×
            </button>
            <img src={selected} alt="receipt-large" className={styles.modalImage} />
          </div>
        </div>
      )}
    </>
  );
}
