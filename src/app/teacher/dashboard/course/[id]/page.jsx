"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import "./detail.css";

export default function CourseDetailPage() {
  const { id } = useParams();

  const course = {
    id,
    name: id === "1" ? "Web Programming" : id === "2" ? "Hotel Management" : "Digital Marketing",
    totalFee: "¥900,000",
    students: [
      {
        id: "ST2024001",
        name: "田中 太郎",
        year: "3年生 A組",
        paid: 320000,
        total: 480000,
        status: "一部支払い",
        date: "2024-01-15",
        receipt: "/receipts/receipt1.png", // image path
      },
      {
        id: "ST2024002",
        name: "佐藤 花子",
        year: "3年生 A組",
        paid: 480000,
        total: 480000,
        status: "完了",
        date: "2024-01-10",
        receipt: "/receipts/receipt2.png",
      },
      {
        id: "ST2024003",
        name: "鈴木 次郎",
        year: "2年生 B組",
        paid: 160000,
        total: 480000,
        status: "返済",
        date: "2024-01-12",
        receipt: "/receipts/receipt3.png",
      },
    ],
  };

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null); // NEW

  const getStatusColor = (status) => {
    switch (status) {
      case "完了": return "#57C785";
      case "一部支払い": return "#F0B84C";
      case "返済": return "#F76C6C";
      default: return "#999";
    }
  };

  return (
    <div className="course-detail">
      <header className="course-header">
        <div>
          <h2>{course.name} コース</h2>
          <p className="course-sub">授業料合計: <strong>{course.totalFee}</strong></p>
        </div>
        <button className="back-btn" onClick={() => history.back()}>← 戻る</button>
      </header>

      <section className="card">
        <h3 className="section-title">生徒一覧</h3>

        <table className="student-table">
          <thead>
            <tr>
              <th>生徒情報</th>
              <th>学年・クラス</th>
              <th>支払い状況</th>
              <th>最終支払日</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {course.students.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="student-info">
                    <div className="avatar">{s.name.charAt(0)}</div>
                    <div>
                      <div className="student-name">{s.name}</div>
                      <div className="student-id">{s.id}</div>
                    </div>
                  </div>
                </td>
                <td>{s.year}</td>
                <td>
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div className="progress-fill"
                        style={{ width: `${(s.paid / s.total) * 100}%`, backgroundColor: "#4F9DDE" }}>
                      </div>
                    </div>
                    <span className="payment-text">
                      ¥{s.paid.toLocaleString()} / ¥{s.total.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td>{s.date}</td>
                <td>
                  <span className="status-badge" style={{ backgroundColor: getStatusColor(s.status) }}>
                    {s.status}
                  </span>
                </td>
                <td>
                  <button className="view-btn" onClick={() => setSelectedStudent(s)}>詳細</button>
                  {/* <button className="remind-btn" onClick={() => setReceiptImage(s.receipt)}>催促</button> */}
               <button className="remind-btn" onClick={() => setReceiptImage(s)}>催促</button>

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 詳細 Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>生徒詳細</h3>
            <div className="modal-info">
              <p><strong>名前:</strong> {selectedStudent.name}</p>
              <p><strong>学年・クラス:</strong> {selectedStudent.year}</p>
              <p><strong>支払い状況:</strong> ¥{selectedStudent.paid.toLocaleString()} / ¥{selectedStudent.total.toLocaleString()}</p>
              <p><strong>状態:</strong> {selectedStudent.status}</p>
              <p><strong>最終支払日:</strong> {selectedStudent.date}</p>
            </div>
            <div className="modal-actions">
              <button className="close-btn" onClick={() => setSelectedStudent(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {receiptImage && (
  <div className="modal-overlay" onClick={() => setReceiptImage(null)}>
    <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
      <h3>学費領収書</h3>

      <div className="receipt-box">
        <p><strong>学校名:</strong> 東京情報専門学校</p>
        <p><strong>日付:</strong> {new Date().toLocaleDateString()}</p>
        <hr />
        <p><strong>生徒名:</strong> {receiptImage.name}</p>
        <p><strong>学生番号:</strong> {receiptImage.id}</p>
        <p><strong>コース:</strong> {course.name}</p>
        <p><strong>支払額:</strong> ¥{receiptImage.paid.toLocaleString()}</p>
        <p><strong>総額:</strong> ¥{receiptImage.total.toLocaleString()}</p>
        <p><strong>支払状態:</strong> {receiptImage.status}</p>
        <hr />
        <p className="thank">領収いたしました。ありがとうございました。</p>
      </div>

      <button className="print-btn" onClick={() => window.print()}>🖨️ 印刷</button>
      <button className="close-btn" onClick={() => setReceiptImage(null)}>閉じる</button>
    </div>
  </div>
)}

    </div>
  );
}
