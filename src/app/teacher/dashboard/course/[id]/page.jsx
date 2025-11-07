"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/firebase/clientApp";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import "../page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
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
    const unsubscribe = onSnapshot(coursesRef, (snapshot) => {
      const fetchedCourses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCourses(fetchedCourses);
    });

    return () => unsubscribe();
  }, []);

  // ✅ students コレクションを購読して、コースごとの実数を表示する
  useEffect(() => {
    const studentsRef = collection(db, "students");
    const unsub = onSnapshot(studentsRef, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(fetched);
    });
    return () => unsub();
  }, []);

  // ✅ 日本語・英語どちらでも courseKey を自動判定する関数
  const determineCourseKey = (courseName = "") => {
    const name = courseName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace("コース", "")
      .replace("科", "");

    const nameMap = {
      japanese: ["日本語ビジネス", "日本語", "japanese", "japanesebusiness"],
      kokusai: ["国際ビジネスコース", "国際", "kokusai", "kokusaiBussiness"],
      it: ["it", "情報技術"],
      web: ["web", "ウェブ", "webプログラミング", "ウェブプログラミング"],
      global: ["global", "グローバル", "globalbusiness", "グローバルビジネス"],
    };

    for (const [key, values] of Object.entries(nameMap)) {
      if (values.some((v) => name.includes(v))) {
        return key;
      }
    }

    // fallback（英語スラッグ化）
    return name.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  };

  // ✅ 新しいコースを追加
  const handleAddCourse = async () => {
    if (!newCourse.name || !newCourse.fee || !newCourse.year)
      return alert("Please fill all fields");

    // ¥800,000 → 800000 に変換
    const parsedPrice = Number(
      String(newCourse.fee).replace(/[^0-9.-]+/g, "") || 0
    );
    // 🔹 日本語でも courseKey 自動判定
    const courseKey = determineCourseKey(newCourse.name);

    // // generate a courseKey slug from name
    // const generatedKey = String(newCourse.name || "")
    //   .toLowerCase()
    //   .trim()
    //   .replace(/[^a-z0-9]+/g, "-")
    //   .replace(/^-+|-+$/g, "");

    const payload = {
      name: newCourse.name || newCourse.nameJa || newCourse.nameEn,
      nameJa: newCourse.nameJa || null,
      nameEn: newCourse.nameEn || null,
      courseKey: courseKey || "",
      fee: newCourse.fee,
      pricePerMonth: parsedPrice,
      year: newCourse.year,
      students: 0,
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
        <h2>Courses Management</h2>

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
          + New Course
        </button>
      </header>

      <table className="courses-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Course Name</th>
            <th>Fee</th>
            <th>Students</th>
            <th>Year</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCourses.map((c, index) => (
            <tr key={c.id}>
              <td>{index + 1}</td>
              <td>
                {c.nameJa && c.nameEn
                  ? `${c.nameJa} / ${c.nameEn}`
                  : c.name || c.nameJa || c.nameEn || c.courseKey || c.id}
              </td>
              <td>{c.fee}</td>
              <td>
                {
                  // 優先: students ドキュメントに保存されている courseDocId を使って厳密に照合
                  students.filter((s) => {
                    if (s.courseDocId) {
                      // StudentAutoRegister が保存するドキュメントIDで比較
                      return s.courseDocId === (c.id ?? c.courseId ?? "");
                    }
                    // フォールバック: 古いデータでは student.courseId に courseKey が入っている場合がある
                    return s.courseId === (c.courseKey ?? c.courseId ?? "");
                  }).length ||
                    (c.students ?? 0)
                }
              </td>
              <td>{c.year}</td>
              <td>
                <Link
                  href={`/teacher/dashboard/course/${c.courseKey ?? c.id}`}
                  className="view-btn"
                >
                  View
                </Link>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteCourse(c.id)}
                >
                  Delete
                </button>
                {/* <button
                  className="edit-btn"
                  onClick={() => handleEditCourse(c.id)}
                >
                  Edit
                </button> */}
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
            {/* <input
              type="text"
              placeholder="Course Name (日本語、任意)"
              value={newCourse.nameJa}
              onChange={(e) =>
                setNewCourse({ ...newCourse, nameJa: e.target.value })
              }
            /> */}
            {/* <input
              type="text"
              placeholder="Course Name (English, optional)"
              value={newCourse.nameEn}
              onChange={(e) =>
                setNewCourse({ ...newCourse, nameEn: e.target.value })
              }
            /> */}
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
