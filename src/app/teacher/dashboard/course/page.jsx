"use client";
import { useState } from "react";
import Link from "next/link";
import "./page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([
    { id: 1, name: "Web Programming", fee: "¥800,000", students: 35 },
    { id: 2, name: "Hotel Management", fee: "¥750,000", students: 28 },
    { id: 3, name: "Digital Marketing", fee: "¥680,000", students: 22 },
  ]);

  const [newCourse, setNewCourse] = useState({ name: "", fee: "" });

  const handleAddCourse = () => {
    if (!newCourse.name || !newCourse.fee) return alert("Please fill all fields");
    const id = courses.length + 1;
    setCourses([...courses, { ...newCourse, id, students: 0 }]);
    setNewCourse({ name: "", fee: "" });
  };

  const handleDeleteCourse = (id) => {
    if (confirm("Are you sure you want to delete this course?")) {
      setCourses(courses.filter((c) => c.id !== id));
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
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.fee}</td>
              <td>{c.students}</td>
              <td>
                <Link href={`/courses/${c.id}`} className="view-btn">
                  View
                </Link>
                <button className="delete-btn" onClick={() => handleDeleteCourse(c.id)}>
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
