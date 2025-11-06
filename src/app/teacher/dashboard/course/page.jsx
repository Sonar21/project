"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/firebase/clientApp";
import {
  collection,
  query,
  where,
  getCountFromServer,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  increment ,
} from "firebase/firestore";

import "./page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState({
    name: "",
    nameJa: "",
    nameEn: "",
    fee: "",
    year: "1st Year",
  });
  const [activeYear, setActiveYear] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  

  // ✅ Firestoreからコースをリアルタイム取得
 useEffect(() => {
  const coursesRef = collection(db, "courses");

  const unsubscribe = onSnapshot(coursesRef, async (snapshot) => {
    try {
      const fetchedCourses = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const courseData = { id: docSnap.id, ...docSnap.data() };

          try {
            // Count students who have courseId equal to this course id
            const studentsRef = collection(db, "students");
            const q = query(studentsRef, where("courseId", "==", docSnap.id));
            const countSnap = await getCountFromServer(q);
            const studentCount = countSnap.data()?.count ?? 0;

            return { ...courseData, students: studentCount };
          } catch (err) {
            console.error("count error for course", docSnap.id, err);
            // fallback to stored field
            return { ...courseData, students: courseData.students ?? 0 };
          }
        })
      );

      setCourses(fetchedCourses);
    } catch (err) {
      console.error("Error processing courses snapshot", err);
    }
  });

  return () => unsubscribe();
}, []);


  // ✅ 新しいコースを追加
  const handleAddCourse = async () => {
    if (!newCourse.name || !newCourse.fee || !newCourse.year)
      return alert("Please fill all fields");

    // ¥800,000 → 800000 に変換
    const parsedPrice = Number(
      String(newCourse.fee).replace(/[^0-9.-]+/g, "") || 0
    );

    // generate a courseKey slug from name
    const generatedKey = String(newCourse.name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const payload = {
      name: newCourse.name || newCourse.nameJa || newCourse.nameEn,
      nameJa: newCourse.nameJa || null,
      nameEn: newCourse.nameEn || null,
      courseKey: generatedKey,
      fee: newCourse.fee,
      pricePerMonth: parsedPrice,
      year: newCourse.year,
      students: newCourse.students || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const coursesRef = collection(db, "courses");
      const docRef = await addDoc(coursesRef, payload);

      // 保守のためドキュメントIDも記録しておく（legacy）
      await updateDoc(doc(db, "courses", docRef.id), {
        courseId: docRef.id,
        updatedAt: serverTimestamp(),
      });

      // モーダルを閉じてフォームをリセット
      setNewCourse({ name: "", fee: "", year: "1st Year" });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save course to Firestore:", err);
      alert("コースの保存に失敗しました。");
    }
  };

  // ✅ Firestoreから削除
  const handleDeleteCourse = async (id) => {
    if (confirm("Are you sure you want to delete this course?")) {
      try {
        await deleteDoc(doc(db, "courses", id));
        alert("コースを削除しました。");
      } catch (err) {
        console.error("Failed to delete course:", err);
        alert("削除に失敗しました。");
      }
    }
  };

  // ✅ 年次でフィルター
  const filteredCourses =
    activeYear === "All"
      ? courses
      : courses.filter((c) => c.year === activeYear);

  return (
    <div className="courses-page">
      <header className="courses-header">
        <h2>コース管理</h2>

        <div className="filter-tabs">
          <button
            className={activeYear === "All" ? "active" : ""}
            onClick={() => setActiveYear("All")}
          >
            All
          </button>
          <button
            className={activeYear === "1st Year" ? "active" : ""}
            onClick={() => setActiveYear("1st Year")}
          >
            1st Year
          </button>
          <button
            className={activeYear === "2nd Year" ? "active" : ""}
            onClick={() => setActiveYear("2nd Year")}
          >
            2nd Year
          </button>
        </div>

        <button className="add-btn" onClick={() => setIsModalOpen(true)}>
          +コース追加
        </button>
      </header>

      <table className="courses-table">
        <thead>
          <tr>
            <th>No</th>
            <th>コース名</th>
            <th>学費</th>
            <th>学生数</th>
            <th>学年</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCourses.map((c, index) => (
            <tr key={c.id}>
              <td>{index + 1}</td>
              <td>
                {/* {c.nameJa && c.nameEn
                  ? `${c.nameJa} / ${c.nameEn}`
                  : c.name || c.nameJa || c.nameEn || c.courseKey || c.id} */}
                  <Link
                    href={`/teacher/dashboard/course/${c.courseKey ?? c.id}`}
                    className="course-link"
                  >
                    {c.nameJa && c.nameEn
                      ? `${c.nameJa} / ${c.nameEn}`
                      : c.name || c.nameJa || c.nameEn || c.courseKey || c.id}
 　　　　　　　　　 </Link>   
              </td>
              <td>{c.fee}</td>
              <td>{c.students ?? 0}</td>
              <td>{c.year}</td>
              <td>
                <Link
// href={`/teacher/dashboard/course/${c.courseKey ?? c.id}/edit`}
href={`/teacher/dashboard/course/${c.id}/edit`}
                  className="view-btn"
                >
                  Edit
                </Link>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteCourse(c.id)}
                >
                  Delete
                </button>
                
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ 新しいコース追加モーダル */}
      {isModalOpen && (
        <div className="add-modal">
          <div className="modal-content">
            <h3>Add New Course</h3>
            <input
              type="text"
              placeholder="Course Name (display fallback)"
              value={newCourse.name}
              onChange={(e) =>
                setNewCourse({ ...newCourse, name: e.target.value })
              }
            />
           
            <input
              type="text"
              placeholder="Fee (e.g. ¥900,000)"
              value={newCourse.fee}
              onChange={(e) =>
                setNewCourse({ ...newCourse, fee: e.target.value })
              }
            />
            <select
              value={newCourse.year}
              onChange={(e) =>
                setNewCourse({ ...newCourse, year: e.target.value })
              }
            >
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>

            <div className="modal-actions">
              <button onClick={handleAddCourse} className="save-btn">
                Save
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}