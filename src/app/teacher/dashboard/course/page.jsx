"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import "./page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);

  const [newCourse, setNewCourse] = useState({ name: "", fee: "" });

  useEffect(() => {
    // load courses from server
    fetch("/api/admin/courses")
      .then((r) => r.json())
      .then((data) => setCourses(data || []))
      .catch(() => setCourses([]));
  }, []);

  const handleAddCourse = () => {
    if (!newCourse.name || !newCourse.fee) return alert("Please fill all fields");
    const id = courses.length + 1;
    setCourses([...courses, { ...newCourse, id, students: 0 }]);
    setNewCourse({ name: "", fee: "" });
  };

  const handleDeleteCourse = (id) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    fetch('/api/admin/courses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: id }),
    }).then(() => {
      // refresh
      fetch("/api/admin/courses").then((r) => r.json()).then((data) => setCourses(data || []));
    });
  };

  const refresh = async () => {
    const r = await fetch('/api/admin/courses');
    setCourses(await r.json());
  };

  function parseTuitionByYearInput(input) {
    // expected format: "1:50000,2:100000,default:90000"
    if (!input || !input.trim()) return null;
    const parts = input.split(",");
    const obj = {};
    for (const p of parts) {
      const s = p.split(":");
      if (s.length !== 2) continue;
      const k = s[0].trim();
      const v = Number(String(s[1]).replace(/[^0-9]/g, ""));
      if (!Number.isNaN(v)) obj[k] = v;
    }
    return Object.keys(obj).length ? obj : null;
  }

  const handleEditYearFees = async (course) => {
    const existing = course.tuitionByYear
      ? Object.entries(course.tuitionByYear)
          .map(([k, v]) => `${k}:${v}`)
          .join(',')
      : '';
    const input = prompt(
      `学年別学費を入力してください（例: 1:50000,2:100000,default:90000）`,
      existing
    );
    if (input === null) return;
    const parsed = parseTuitionByYearInput(input);
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: course.code || course.id, tuitionByYear: parsed }),
      });
      if (res.ok) {
        await refresh();
      } else {
        alert('Failed to update tuitionByYear');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating tuitionByYear');
    }
  };

  return (
    <div className="courses-page">
      <header className="courses-header">
        <h2>Courses Management</h2>
        <button
          className="add-btn"
          onClick={() => {
            const modal = document.querySelector(".add-modal");
            modal.style.display = "flex";
          }}
        >
          + New Course
        </button>
      </header>

      <table className="courses-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Course Name</th>
            <th>Fee</th>
            <th>Students</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.code || c.id}>
              <td>{c.code || c.id}</td>
              <td>{c.name}</td>
              <td>
                {c.tuition
                  ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Number(c.tuition))
                  : '-'}
                {c.tuitionByYear ? (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    学年別設定あり
                  </div>
                ) : null}
              </td>
              <td>{c.students || '-'}</td>
              <td>
                <Link href={`/courses/${c.code || c.id}`} className="view-btn">
                  View
                </Link>
                <button className="edit-btn" onClick={() => handleEditYearFees(c)}>
                  Edit Year Fees
                </button>
                <button className="delete-btn" onClick={() => handleDeleteCourse(c.code || c.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add New Course Modal */}
      <div className="add-modal">
        <div className="modal-content">
          <h3>Add New Course</h3>
          <input
            type="text"
            placeholder="Course Name"
            value={newCourse.name}
            onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Fee (e.g. ¥900,000)"
            value={newCourse.fee}
            onChange={(e) => setNewCourse({ ...newCourse, fee: e.target.value })}
          />
          <div className="modal-actions">
            <button onClick={handleAddCourse} className="save-btn">Save</button>
            <button
              onClick={() => (document.querySelector(".add-modal").style.display = "none")}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
