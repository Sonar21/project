"use client";

import React from "react";
import Image from "next/image";
import styles from "./ReceiptList.module.css";

// payments: array of { id, amount, receiptUrl, receiptBase64, createdAt }
export default function ReceiptList({ payments = [] }) {
  if (!payments || payments.length === 0) return <span>-</span>;

  return (
    <div className={styles.container}>
      {payments.map((p) => (
        <div key={p.id || p.receiptUrl} className={styles.item}>
          <div className={styles.amount}>
            {p.amount ? `¥${Number(p.amount).toLocaleString()}` : "-"}
          </div>
          {p.receiptBase64 ? (
            // receiptBase64 is a data URL (e.g. data:image/png;base64,...)
            // Use regular <img> since next/image doesn't accept data URLs reliably.
            <div>
              <img
                src={p.receiptBase64}
                alt={`receipt-${p.id || "img"}`}
                className={styles.thumb}
                style={{ width: 400, height: 300, objectFit: "cover" }}
              />
              <div style={{ marginTop: 6 }}>
                <a href={p.receiptBase64} target="_blank" rel="noreferrer">
                  画像を新しいタブで開く
                </a>
                <div style={{ fontSize: 12, color: "#666" }}>
                  prefix: {String(p.receiptBase64).slice(0, 30)}… length:{" "}
                  {String(p.receiptBase64).length}
                </div>
              </div>
            </div>
          ) : p.receiptUrl ? (
            <Image
              src={p.receiptUrl}
              alt={`receipt-${p.id || "img"}`}
              className={styles.thumb}
              width={400}
              height={300}
              unoptimized={true}
            />
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
