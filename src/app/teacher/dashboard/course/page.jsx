"use client";
import { useState } from "react";
import Link from "next/link";
import "./page.css";

export default function CoursesPage() {
  const [courses, setCourses] = useState([
    { id: 1, name: "Web Programming", fee: "¥800,000", students: 35, year: "1st Year" },
    { id: 2, name: "Hotel Management", fee: "¥750,000", students: 28, year: "2nd Year" },
    { id: 3, name: "Digital Marketing", fee: "¥680,000", students: 22, year: "1st Year" },
  ]);

  const [newCourse, setNewCourse] = useState({ name: "", fee: "", year: "1st Year" });
  const [activeYear, setActiveYear] = useState("All");

  const handleAddCourse = () => {
    if (!newCourse.name || !newCourse.fee || !newCourse.year)
      return alert("Please fill all fields");

    const id = courses.length + 1;
    setCourses([...courses, { ...newCourse, id, students: 0 }]);
    setNewCourse({ name: "", fee: "", year: "1st Year" });
    document.querySelector(".add-modal").style.display = "none";
  };

  const handleDeleteCourse = (id) => {
    if (confirm("Are you sure you want to delete this course?")) {
      setCourses(courses.filter((c) => c.id !== id));
    }
  };

  const filteredCourses =
    activeYear === "All" ? courses : courses.filter((c) => c.year === activeYear);

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

        <button
          className="add-btn"
          onClick={() => (document.querySelector(".add-modal").style.display = "flex")}
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
            <th>Year</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCourses.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.fee}</td>
              <td>{c.students}</td>
              <td>{c.year}</td>
              <td>
                <Link href={`/teacher/dashboard/course/${c.id}`} className="view-btn">
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

          <select
            value={newCourse.year}
            onChange={(e) => setNewCourse({ ...newCourse, year: e.target.value })}
          >
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
          </select>

          <div className="modal-actions">
            <button onClick={handleAddCourse} className="save-btn">
              Save
            </button>
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
