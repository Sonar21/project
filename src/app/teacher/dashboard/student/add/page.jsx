"use client";

import { useState } from "react";
import { db } from "@/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "./add.css"; // optional styles

export default function AddStudentPage() {
	const [student, setStudent] = useState({
		studentId: "",
		name: "",
		nameKana: "",
		email: "",
		courseId: "",
		startMonth: "",
	});

	const [loading, setLoading] = useState(false);

	const handleChange = (e) => {
		setStudent({ ...student, [e.target.name]: e.target.value });
	};

	const handleSubmit = async () => {
		if (
			!student.studentId ||
			!student.name ||
			!student.nameKana ||
			!student.email ||
			!student.courseId ||
			!student.startMonth
		) {
			alert("全ての項目を入力してください。");
			return;
		}

		setLoading(true);
		try {
			// Use student.studentId as the document ID to keep it consistent across the app
			const studentRef = doc(db, "students", String(student.studentId));
			await setDoc(studentRef, {
				studentId: student.studentId,
				name: student.name,
				nameKana: student.nameKana,
				email: student.email,
				courseId: student.courseId,
				startMonth: student.startMonth,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});

			alert(`学生を登録しました！（ID: ${student.studentId}）`);
			setStudent({
				studentId: "",
				name: "",
				nameKana: "",
				email: "",
				courseId: "",
				startMonth: "",
			});
		} catch (error) {
			console.error("Firestore への追加に失敗しました:", error);
			alert("登録に失敗しました。");
		}
		setLoading(false);
	};

	return (
		<div className="add-student-page">
			<h2>🧑‍🎓 新しい学生を登録</h2>

			<div className="form-container">
				<label>
					学生ID：
					<input
						name="studentId"
						value={student.studentId}
						onChange={handleChange}
						placeholder="例: w24001"
					/>
				</label>

				<label>
					名前：
					<input
						name="name"
						value={student.name}
						onChange={handleChange}
						placeholder="例: 田中 太郎"
					/>
				</label>

				<label>
					名前（カタカナ）：
					<input
						name="nameKana"
						value={student.nameKana}
						onChange={handleChange}
						placeholder="例: タナカ タロウ"
					/>
				</label>

				<label>
					メールアドレス：
					<input
						name="email"
						type="email"
						value={student.email}
						onChange={handleChange}
						placeholder="例: tanaka@example.com"
					/>
				</label>

				<label>
					所属コースID：
					<input
						name="courseId"
						value={student.courseId}
						onChange={handleChange}
						placeholder="例: web"
					/>
				</label>

				<label>
					支払い開始月：
					<input
						name="startMonth"
						value={student.startMonth}
						onChange={handleChange}
						placeholder="例: 2025-04"
					/>
				</label>

				<button onClick={handleSubmit} disabled={loading}>
					{loading ? "登録中..." : "登録する"}
				</button>
			</div>
		</div>
	);
}
