"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/firebase/clientApp";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import "./edit.css";

export default function EditCoursePage() {
  const { id } = useParams();
  const router = useRouter();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch course data
    useEffect(() => {
      const fetchCourse = async () => {
        try {
          const docRef = doc(db, "courses", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setCourse({ id: docSnap.id, ...docSnap.data() });
          } else {
            alert("Course not found");
            router.push("/teacher/dashboard/course");
          }
        } catch (err) {
          console.error("Error fetching course:", err);
        } finally {
          setLoading(false);
        }
      };
      if (id) fetchCourse();
    }, [id, router]);

  // ✅ Update course
  const handleUpdate = async () => {
    if (!course.name || !course.fee || !course.year) {
      alert("すべての項目を入力してください。");
      return;
    }

    try {
      const docRef = doc(db, "courses", id);
      // normalize permonth -> numeric pricePerMonth and keep permonth string for display
      const permonthStr = String(course.permonth || "").trim();
      const parsed = Number(permonthStr.replace(/[^0-9.-]+/g, "")) || null;
      const updatePayload = {
        name: course.name,
        fee: course.fee,
        year: course.year,
        updatedAt: serverTimestamp(),
      };
      if (permonthStr !== "") {
        updatePayload.pricePerMonth = parsed;
        updatePayload.permonth = permonthStr;
      } else {
        // if empty, remove numeric field? we'll set to null
        updatePayload.pricePerMonth = null;
        updatePayload.permonth = null;
      }

      await updateDoc(docRef, updatePayload);
      alert("コース情報を更新しました！");
      router.push("/teacher/dashboard/course");
    } catch (err) {
      console.error("Update error:", err);
      alert("更新に失敗しました。");
    }
  };

  // ✅ Delete course
  const handleDelete = async () => {
    if (confirm("本当にこのコースを削除しますか？")) {
      try {
        await deleteDoc(doc(db, "courses", id));
        alert("コースを削除しました。");
        router.push("/teacher/dashboard/course");
      } catch (err) {
        console.error("Delete error:", err);
        alert("削除に失敗しました。");
      }
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!course) return <p>Course not found</p>;

  return (
    <div className="edit-page-container">
      <div className="edit-card">
        <h2 className="edit-title">コース編集</h2>

        <div className="edit-field">
          <label>コース名</label>
          <input
            type="text"
            value={course.name || ""}
            onChange={(e) => setCourse({ ...course, name: e.target.value })}
          />
        </div>
        
        <div className="edit-field">
          <label>月額料金</label>
          <input
            type="text"
            value={course.permonth || ""}
            onChange={(e) => setCourse({ ...course, permonth: e.target.value })}
          />
        </div>


        <div className="edit-field">
          <label>学費</label>
          <input
            type="text"
            value={course.fee || ""}
            onChange={(e) => setCourse({ ...course, fee: e.target.value })}
          />
        </div>

        <div className="edit-field">
          <label>学年</label>
          <select
            value={course.year || ""}
            onChange={(e) => setCourse({ ...course, year: e.target.value })}
          >
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
          </select>
        </div>

        <div className="edit-actions">
          <button className="save-btn" onClick={handleUpdate}>
            💾 保存
          </button>

          <button
            className="cancel-btn"
            onClick={() => router.push("/teacher/dashboard/course")}
          >
            ← 戻る
          </button>
        </div>
      </div>
    </div>
  );
}