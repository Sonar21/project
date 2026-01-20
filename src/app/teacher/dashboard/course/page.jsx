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

import "./page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState({
    name: "",
    nameJa: "",
    nameEn: "",
    fee: "",
    permonth: "",
    // monthly template for Feb (02) through Oct (10)
    monthlyTemplate: {
      "02": "",
      "03": "",
      "04": "",
      "05": "",
      "06": "",
      "07": "",
      "08": "",
      "09": "",
      10: "",
    },
    year: "1st Year",
    // Explicit academic year to use for payment schedules (e.g. 2025 for Apr2025-Mar2026)
    paymentAcademicYear: 2025,
  });
  const [activeYear, setActiveYear] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ Courses listener: rely on `courses/{course}.students` being kept in sync by Cloud Functions.
  // This is efficient (single listener) and updates immediately when counters change.
  useEffect(() => {
    const coursesRef = collection(db, "courses");
    const unsubscribe = onSnapshot(coursesRef, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        students: d.data().students ?? 0,
      }));
      setCourses(list);
    });
    return () => unsubscribe();
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

    // 月額が入力されていればそれを優先、なければ学費から算出
    const priceSource = newCourse.permonth ? newCourse.permonth : newCourse.fee;
    const parsedPrice = Number(
      String(priceSource || "").replace(/[^0-9.-]+/g, "") || 0
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
      paymentAcademicYear: Number(newCourse.paymentAcademicYear) || null,
      students: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // attach monthly template if provided (normalize numbers)
    try {
      const cleaned = {};
      for (const [m, v] of Object.entries(newCourse.monthlyTemplate || {})) {
        const parsed = Number(String(v || "").replace(/[^0-9.-]+/g, "")) || 0;
        cleaned[m] = parsed;
      }
      if (Object.keys(cleaned).length > 0) payload.monthlyTemplate = cleaned;
    } catch (e) {
      // ignore
    }

    try {
      const coursesRef = collection(db, "courses");
      const docRef = await addDoc(coursesRef, payload);

      // 保守のためドキュメントIDも記録しておく（legacy）
      await updateDoc(doc(db, "courses", docRef.id), {
        courseId: docRef.id,
        updatedAt: serverTimestamp(),
      });

      // モーダルを閉じてフォームをリセット
      setNewCourse({
        name: "",
        fee: "",
        permonth: "",
        monthlyTemplate: {
          "02": "",
          "03": "",
          "04": "",
          "05": "",
          "06": "",
          "07": "",
          "08": "",
          "09": "",
          10: "",
        },
        year: "1st Year",
        paymentAcademicYear: 2025,
      });
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
            全て
          </button>
          <button
            className={activeYear === "1st Year" ? "active" : ""}
            onClick={() => setActiveYear("1st Year")}
          >
            1年生
          </button>
          <button
            className={activeYear === "2nd Year" ? "active" : ""}
            onClick={() => setActiveYear("2nd Year")}
          >
            2年生
          </button>
        </div>

        <button className="add-btn" onClick={() => setIsModalOpen(true)}>
          +コース追加
        </button>
      </header>

      <div className="table-card">
        <table className="courses-table">
          <thead>
            <tr>
              <th>No</th>
              <th>コース名</th>
              <th>学費</th>
              <th>月額</th>
              <th>学生数</th>
              <th>学年</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((c, index) => (
              <tr key={c.id}>
                <td>{index + 1}</td>
                <td className="course-name">
                  {/* {c.nameJa && c.nameEn
    ? ${c.nameJa} / ${c.nameEn}
    : c.name || c.nameJa || c.nameEn || c.courseKey || c.id} */}
                  <Link
                    href={`/teacher/dashboard/course/${c.id}`}
                    className="course-link"
                  >
                    {c.nameJa && c.nameEn
                      ? `${c.nameJa} / ${c.nameEn}`
                      : c.name || c.nameJa || c.nameEn || c.courseKey || c.id}
                  </Link>
                </td>
                <td data-hide-mobile="true">{c.fee}</td>
                <td data-hide-mobile="true">
                  {c.pricePerMonth
                    ? `¥${Number(c.pricePerMonth).toLocaleString()}`
                    : c.permonth
                    ? c.permonth
                    : "-"}
                </td>
                <td>{c.students ?? 0}</td>
                <td className="course-year">{c.year}</td>
                <td>
                  <Link
                    // href={`/teacher/dashboard/course/${c.courseKey ?? c.id}/edit`}
                    href={`/teacher/dashboard/course/${c.id}/edit`}
                    className="view-btn"
                  >
                    編集
                  </Link>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteCourse(c.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ 新しいコース追加モーダル */}
      {isModalOpen && (
        <div className="add-modal">
          <div className="modal-content">
            <h3>新しいコースを追加</h3>
            <input
              type="text"
              placeholder="コース名"
              value={newCourse.name}
              onChange={(e) =>
                setNewCourse({ ...newCourse, name: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="学費 (例: 900000)"
              value={newCourse.fee}
              onChange={(e) =>
                setNewCourse({ ...newCourse, fee: e.target.value })
              }
            />
            <div className="permonth-row">
              <input
                type="text"
                placeholder="月額 (例: 80000)"
                value={newCourse.permonth}
                onChange={(e) =>
                  setNewCourse({ ...newCourse, permonth: e.target.value })
                }
              />
              <button
                type="button"
                className="apply-all-btn"
                onClick={() => {
                  // copy permonth to all monthlyTemplate fields (explicit action)
                  const val = newCourse.permonth || "";
                  setNewCourse((prev) => ({
                    ...prev,
                    monthlyTemplate: Object.fromEntries(
                      Object.keys(prev.monthlyTemplate || {}).map((k) => [
                        k,
                        val,
                      ])
                    ),
                  }));
                }}
              >
                全ての月に適用
              </button>
            </div>

            {/* Monthly template inputs for Feb - Oct */}
            <div className="monthly-templates">
              {/* <h4>Monthly Payments (teacher decides):</h4> */}
              <div className="months-grid">
                {Object.keys(newCourse.monthlyTemplate || {})
                  .sort((a, b) => Number(a) - Number(b))
                  .map((m) => {
                    const monthLabels = {
                      "02": "February",
                      "03": "March",
                      "04": "April",
                      "05": "May",
                      "06": "June",
                      "07": "July",
                      "08": "August",
                      "09": "September",
                      10: "October",
                    };
                    return (
                      <div className="month-row" key={m}>
                        <label>{monthLabels[m] || m}</label>
                        <input
                          type="text"
                          value={newCourse.monthlyTemplate[m] || ""}
                          onChange={(e) =>
                            setNewCourse((prev) => ({
                              ...prev,
                              monthlyTemplate: {
                                ...prev.monthlyTemplate,
                                [m]: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
            <select
              value={newCourse.year}
              onChange={(e) =>
                setNewCourse({ ...newCourse, year: e.target.value })
              }
            >
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>

            <div className="payment-academic-year">
              <label>
                支払学年 (例: 2025 — 学年は Apr2025–Mar2026 の場合 2025)
              </label>
              <input
                type="number"
                placeholder="2025"
                value={newCourse.paymentAcademicYear}
                onChange={(e) =>
                  setNewCourse({
                    ...newCourse,
                    paymentAcademicYear: Number(e.target.value) || null,
                  })
                }
              />
            </div>

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
