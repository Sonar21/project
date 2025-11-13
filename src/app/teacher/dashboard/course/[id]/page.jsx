"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";

import { db } from "@/firebase/clientApp";
import Link from "next/link";
import "./detail.css";

export default function CourseDetailPage() {
  const { id } = useParams(); // The course ID from URL
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([]);

  // 🧩 Load students for this course in real time
  useEffect(() => {
    if (!id) return;


    const q = query(collection(db, "students"), where("courseId", "==", id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id, // Firestore document ID
        ...doc.data(),
      }));
      setStudents(list);
    });

    // Subscribe to students where courseId == id and where courseDocId == id
    // Merge results and deduplicate by document id so students stored under
    // either field are shown in the course detail.
    const qByCourseId = query(collection(db, "students"), where("courseId", "==", id));
    const qByCourseDocId = query(collection(db, "students"), where("courseDocId", "==", id));

    const map = new Map();

    const updateFromSnapshot = (snapshot) => {
      snapshot.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() });
      });
      setStudents(Array.from(map.values()));
    };

    const unsub1 = onSnapshot(qByCourseId, (snapshot) => {
      // rebuild map entries from this query only (avoid stale deletions)
      // but keep other query's entries intact
      snapshot.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() });
      });
      setStudents(Array.from(map.values()));

    });

    const unsub2 = onSnapshot(qByCourseDocId, (snapshot) => {
      snapshot.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...d.data() });
      });
      setStudents(Array.from(map.values()));
    });

    return () => {
      try { unsub1(); } catch (e) {}
      try { unsub2(); } catch (e) {}
    };
  }, [id]);

  // 🔍 Filter students by email or student number
  const filteredStudents = students.filter(
    (s) =>
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 🗑️ Delete a specific student
  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("この学生を削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "students", studentId));
      alert("学生を削除しました。");
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました。");
    }
  };

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
                {/* Student Number → link to student's dashboard */}
                <td>
                  <Link
                    href={`/student/dashboard/${s.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {s.studentId}
                  </Link>
                </td>

{/* Student Name → link to teacher’s student detail */}
<td>
  <Link
    href={`/student/dashboard/${s.studentId}`}
    className="text-blue-600 hover:underline"
  >
    
    {s.name}
  </Link>
</td>

                <td>{s.email}</td>
                <td>{s.startMonth || "-"}</td>
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
                  <button
                    onClick={() => handleDeleteStudent(s.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >

  🗑️ 削除
</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}