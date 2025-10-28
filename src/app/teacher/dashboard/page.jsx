"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";
export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCourse, setNewCourse] = useState({ name: "", fee: "" });

  useEffect(() => {
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((data) => setCourses(data))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const r = await fetch("/api/admin/courses");
    setCourses(await r.json());
  };

  const handleAddCourse = async () => {
    if (!newCourse.name || !newCourse.fee)
      return alert("Please fill all fields");
    // convert fee like ¥900,000 or 900000 to number
    const t = Number(String(newCourse.fee).replace(/[^0-9]/g, "")) || 0;
    await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCourse.name, tuition: t }),
    });
    setNewCourse({ name: "", fee: "" });
    await refresh();
    document.querySelector(".add-modal").style.display = "none";
  };

  const handleDeleteCourse = async (code) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    await fetch("/api/admin/courses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    await refresh();
  };

  const handleEditCourse = async (code, currentTuition) => {
    const input = prompt(
      "新しい学費を入力してください（数字のみ、例: 900000）",
      String(currentTuition || "")
    );
    if (input === null) return; // cancelled
    const t = Number(String(input).replace(/[^0-9]/g, ""));
    if (Number.isNaN(t)) return alert("無効な金額です");
    await fetch("/api/admin/courses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tuition: t }),
    });
    await refresh();
  };

  const fmt = (n) =>
    new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(n);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={styles["courses-page"]}>
      <header className="courses-header">
        <h2>Courses Management</h2>
        <button
          className={styles["add-btn"]}
          onClick={() => {
            const modal = document.querySelector(".add-modal");
            modal.style.display = "flex";
          }}
        >
          + New Course
        </button>
      </header>

      <table className={styles["courses-table"]}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Course Name</th>
            <th>Fee</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.code}>
              <td>{c.code}</td>
              <td>{c.name}</td>
              <td>{fmt(c.tuition)}</td>
              <td>
                <Link
                  href={`/courses/${c.code}`}
                  className={styles["view-btn"]}
                >
                  View
                </Link>
                <button
                  className={styles["edit-btn"]}
                  onClick={() => handleEditCourse(c.code, c.tuition)}
                >
                  Edit
                </button>
                <button
                  className={styles["delete-btn"]}
                  onClick={() => handleDeleteCourse(c.code)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add New Course Modal */}
      <div className="add-modal">
        <div className={styles["modal-content"]}>
          <h3>Add New Course</h3>
          <input
            type="text"
            placeholder="Course Name"
            value={newCourse.name}
            onChange={(e) =>
              setNewCourse({ ...newCourse, name: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Fee (e.g. 900000 or ¥900,000)"
            value={newCourse.fee}
            onChange={(e) =>
              setNewCourse({ ...newCourse, fee: e.target.value })
            }
          />
          <div className="modal-actions">
            <button onClick={handleAddCourse} className={styles["save-btn"]}>
              Save
            </button>
            <button
              onClick={() =>
                (document.querySelector(".add-modal").style.display = "none")
              }
              className={styles["cancel-btn"]}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
