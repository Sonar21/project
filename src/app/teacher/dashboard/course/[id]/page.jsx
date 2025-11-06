"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/clientApp"; // ← あなたのFirebase設定
import "./detail.css";
import Link from "next/link";

export default function CourseDetailPage() {
  const { id } = useParams(); // 例: "web"
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (!id) return;

    // Firestore の students コレクションから、指定コース（courseId）の学生を取得
    const q = query(collection(db, "students"), where("courseId", "==", id));

    // onSnapshotでリアルタイム更新
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id, // Firestore のドキュメントID
        ...doc.data(),
      }));
      setStudents(list);
    });

    return () => unsubscribe();
  }, [id]);

  // 🔍 検索フィルター
  const filteredStudents = students.filter(
    (s) =>
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="course-detail-page">
      <header className="course-header">
        <h2>Course Detail - {id}</h2>
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
            <th>Start Month</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                学生データがありません。
              </td>
            </tr>
          ) : (
            filteredStudents.map((s) => (
              <tr key={s.id}>
                <td>
    <Link
      href={`/student/dashboard`} // or student.studentNumber
      className="text-blue-600 hover:underline"
    >
      {s.studentId}
    </Link>
  </td>

                 <td>
    <Link
      href={`/student/dashboard`} // or student.studentNumber
      className="text-blue-600 hover:underline"
    >
      {s.name}
    </Link>
  </td>
                <td>{s.email}</td>
                <td>{s.startMonth}</td>
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
                    {s.status || "未設定"}
                  </span>
                </td>
                <td>
                  <button className="view-btn">詳細</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
