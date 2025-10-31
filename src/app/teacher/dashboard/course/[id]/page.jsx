"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import "./detail.css";

export default function CourseDetailPage() {
  const { id } = useParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([
    { id: "w24001", name: "田中 太郎", email: "tanaka@example.com", paid: "¥320,000 / ¥480,000", status: "一部支払い" },
    { id: "w24002", name: "佐藤 花子", email: "sato@example.com", paid: "¥480,000 / ¥480,000", status: "完了" },
    { id: "w24003", name: "鈴木 次郎", email: "suzuki@example.com", paid: "¥160,000 / ¥480,000", status: "保留" },
  ]);

  // 🔍 Filtering function
  const filteredStudents = students.filter(
    (s) =>
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="course-detail-page">
      <header className="course-header">
        <h2>Course Detail - ID: {id}</h2>
        <input
          type="text"
          className="search-input"
          placeholder="Search by Email or Student Number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <table className="students-table">
        <thead>
          <tr>
            <th>Student Number</th>
            <th>Name</th>
            <th>Email</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.paid}</td>
              <td>
                <span
                  className={
                    s.status === "完了"
                      ? "status success"
                      : s.status === "一部支払い"
                      ? "status partial"
                      : "status pending"
                  }
                >
                  {s.status}
                </span>
              </td>
              <td>
                <button className="view-btn">詳細</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
