"use client";

import React from "react";
import styles from "./ReceiptList.module.css";

// payments: array of { id, amount, receiptUrl, createdAt }
export default function ReceiptList({ payments = [] }) {
  if (!payments || payments.length === 0) return <span>-</span>;

  return (
    <div className={styles.container}>
      {payments.map((p) => (
        <div key={p.id || p.receiptUrl} className={styles.item}>
          <div className={styles.amount}>
            {p.amount ? `¥${Number(p.amount).toLocaleString()}` : "-"}
          </div>
          {p.receiptUrl ? (
            <a href={p.receiptUrl} target="_blank" rel="noreferrer">
              <img
                src={p.receiptUrl}
                alt={`receipt-${p.id || "img"}`}
                className={styles.thumb}
              />
            </a>
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderText}>No image</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
