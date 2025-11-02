"use client";

import React, { useEffect, useState } from "react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/courses").then((r) => r.json()),
    ])
      .then(([usersData, coursesData]) => {
        setUsers(usersData);
        setCourses(coursesData || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (studentId, role) => {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, role }),
    });
    // refresh
    const res = await fetch("/api/admin/users");
    setUsers(await res.json());
  };

  const changeCourse = async (studentId, course) => {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // send as courseId to align with backend/Firestore
      body: JSON.stringify({ studentId, courseId: course }),
    });
    const res = await fetch("/api/admin/users");
    setUsers(await res.json());
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin - Users</h1>
      <table>
        <thead>
          <tr>
            <th>studentId</th>
            <th>name</th>
            <th>role</th>
                <th>course</th>
            <th>action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.studentId}>
              <td>{u.studentId}</td>
              <td>{u.name}</td>
              <td>{u.role}</td>
                <td>
                <select
                  value={u.courseId || ""}
                  onChange={(e) => changeCourse(u.studentId, e.target.value)}
                >
                  <option value="">-- none --</option>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} (
                      {new Intl.NumberFormat("ja-JP", {
                        style: "currency",
                        currency: "JPY",
                      }).format(c.tuition)}
                      )
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  onClick={() =>
                    changeRole(
                      u.studentId,
                      u.role === "student" ? "teacher" : "student"
                    )
                  }
                >
                  Toggle Role
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
