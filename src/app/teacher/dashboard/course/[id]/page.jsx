"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  doc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import Link from "next/link";
import "./detail.css";

const DEBUG = true;
const DEBUG_STUDENT_ID = "w24002";

function toSafeNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/[^0-9.-]+/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

export default function CourseDetailPage() {
  const { id } = useParams(); // The course ID from URL
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [paymentsDocsMap, setPaymentsDocsMap] = useState({});
  const [studentIdToDocId, setStudentIdToDocId] = useState({});
  const [schedulesMap, setSchedulesMap] = useState({});

  // Subscribe to students for this course in real time
  useEffect(() => {
    if (!id) return;

    const studentsRef = collection(db, "students");
    const qByCourseId = query(studentsRef, where("courseId", "==", id));
    const qByCourseDocId = query(studentsRef, where("courseDocId", "==", id));

    const handleSnap = (snap1Docs, snap2Docs) => {
      const map = new Map();
      (snap1Docs || []).forEach((d) =>
        map.set(d.id, { id: d.id, ...d.data() })
      );
      (snap2Docs || []).forEach((d) =>
        map.set(d.id, { id: d.id, ...d.data() })
      );
      if (DEBUG)
        console.log("[CourseDetail] handleSnap students count:", map.size);
      const studentsArr = Array.from(map.values());
      setStudents(studentsArr);
      // Build mapping from payment.studentId -> student doc id so payments
      // can be aggregated per student doc reliably.
      const idMap = {};
      studentsArr.forEach((s) => {
        if (s.studentId) idMap[String(s.studentId)] = s.id;
        idMap[s.id] = s.id;
      });
      setStudentIdToDocId(idMap);
    };

    let latestSnap1 = null;
    let latestSnap2 = null;

    const unsub1 = onSnapshot(
      qByCourseId,
      (snap) => {
        latestSnap1 = snap.docs;
        handleSnap(latestSnap1, latestSnap2);
      },
      (err) => console.error("students onSnapshot error (courseId):", err)
    );

    const unsub2 = onSnapshot(
      qByCourseDocId,
      (snap) => {
        latestSnap2 = snap.docs;
        handleSnap(latestSnap1, latestSnap2);
      },
      (err) => console.error("students onSnapshot error (courseDocId):", err)
    );

    return () => {
      unsub1 && unsub1();
      unsub2 && unsub2();
    };
  }, [id]);

  // When students list changes, subscribe to payments for those students in batches using onSnapshot
  useEffect(() => {
    if (!students || students.length === 0) return;

    const paymentsRef = collection(db, "payments");
    // Query payments by known student identifiers (prefer student.studentId, fallback to doc id)
    const ids = students.map((s) => s.studentId || s.id).filter(Boolean);
    if (ids.length === 0) return;

    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize)
      chunks.push(ids.slice(i, i + chunkSize));

    const snapshotsByChunk = new Array(chunks.length).fill(null);
    const unsubs = [];

    const rebuildMapAndDerive = async () => {
      try {
        const map = {};
        const mapDocs = {};
        for (let ci = 0; ci < snapshotsByChunk.length; ci++) {
          const docs = snapshotsByChunk[ci] || [];
          for (const d of docs) {
            const data = d.data();
            const sidRaw = data.studentId || d.id;
            // Map payment.studentId back to the student doc id when possible
            const docId = studentIdToDocId[String(sidRaw)] || String(sidRaw);
            map[docId] = map[docId] || { totalPaid: 0, count: 0 };
            map[docId].totalPaid += toSafeNumber(data.amount || 0);
            map[docId].count += 1;
            mapDocs[docId] = mapDocs[docId] || [];
            mapDocs[docId].push({ id: d.id, data });
          }
        }

        setPaymentsMap(map);
        setPaymentsDocsMap(mapDocs);
        if (DEBUG) console.log("[CourseDetail] setPaymentsMap ->", map);
      } catch (err) {
        console.error("Failed to rebuild payments map:", err);
      }
    };

    chunks.forEach((chunk, idx) => {
      const q = query(paymentsRef, where("studentId", "in", chunk));
      const unsub = onSnapshot(
        q,
        (snap) => {
          snapshotsByChunk[idx] = snap.docs;
          if (DEBUG)
            console.log(
              `[CourseDetail] payments chunk ${idx} snapshot, docs:`,
              snap.docs.length,
              "chunk:",
              chunk
            );
          rebuildMapAndDerive();
        },
        (err) => console.error("payments onSnapshot error:", err)
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u && u());
  }, [students, studentIdToDocId]);

  // Subscribe to each student's paymentSchedules so status reflects updates in realtime.
  useEffect(() => {
    if (!students || students.length === 0) return;

    const unsubs = [];
    const initial = {};
    students.forEach((s) => {
      initial[s.id] = { totalDue: 0, totalPaid: 0, count: 0 };
    });
    setSchedulesMap(initial);

    students.forEach((s) => {
      try {
        const schedRef = collection(db, "students", s.id, "paymentSchedules");
        const unsub = onSnapshot(
          schedRef,
          (snap) => {
            try {
              let totalDue = 0;
              let totalPaid = 0;
              const docs = snap.docs || [];
              docs.forEach((d) => {
                const data = d.data() || {};
                const due = toSafeNumber(data.dueAmount);
                const paid = toSafeNumber(data.paidAmount);
                totalDue += due;
                totalPaid += paid;
                if (DEBUG && (isNaN(due) || isNaN(paid)))
                  console.warn(
                    `[CourseDetail] schedules doc ${d.id} has non-numeric values:`,
                    d.data()
                  );
              });
              setSchedulesMap((prev) => ({
                ...prev,
                [s.id]: { totalDue, totalPaid, count: docs.length },
              }));
              if (DEBUG)
                console.log(
                  `[CourseDetail] onSnapshot schedules for student doc ${s.id}: totalDue=${totalDue} totalPaid=${totalPaid} count=${docs.length} (studentId=${s.studentId})`
                );
            } catch (e) {
              console.error("Error processing schedules snapshot for", s.id, e);
            }
          },
          (err) => console.error("schedules onSnapshot error for", s.id, err)
        );
        unsubs.push(unsub);
      } catch (e) {
        console.error("Failed to subscribe to schedules for", s.id, e);
      }
    });

    return () => unsubs.forEach((u) => u && u());
  }, [students]);

  // Extra debug for single student (no extra reads beyond existing snapshots)
  useEffect(() => {
    if (!students || students.length === 0) return;
    const target = students.find((s) => s.studentId === DEBUG_STUDENT_ID);
    if (!target) return;

    if (DEBUG) {
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] student doc (from students snapshot):`,
        target
      );
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] schedulesMap entry:`,
        schedulesMap[target.id]
      );
      console.log(
        `[CourseDetail][DEBUG:${DEBUG_STUDENT_ID}] paymentsMap entry:`,
        paymentsMap[target.id] || paymentsMap[target.studentId]
      );
    }
  }, [students, schedulesMap, paymentsMap]);

  const filteredStudents = students.filter(
    (s) =>
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("この学生を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "students", studentId));
      alert("学生を削除しました。");
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました。");
    }
  };

  return (
    <div className="course-detail-page">
      <header className="course-header">
        <h2>コース詳細 - {id}</h2>
        <input
          type="text"
          className="search-input"
          placeholder="メールまたは学生記番号で検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <table className="students-table">
        <thead>
          <tr>
            <th>学生記番号</th>
            <th>名前</th>
            <th>メール</th>
            <th>開始月</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                学生データがありません。
              </td>
            </tr>
          ) : (
            filteredStudents.map((s) => {
              const sched = schedulesMap[s.id] || {
                totalDue: 0,
                totalPaid: 0,
                count: 0,
              };
              // paymentsMap keys are payment.studentId; some student docs may not have
              // `studentId` field populated, so fallback to doc id `s.id` when looking up.
              // paymentsMap is aggregated by student doc id (preferred), fallback to studentId
              const pm = paymentsMap[s.id] || paymentsMap[s.studentId];

              // Compute payment percentage using available fields (strict conversion per spec)
              // Determine raw values (prefer student fields, fallback to schedules/payments)
              const rawTotalFee =
                s.totalFee != null
                  ? s.totalFee
                  : s.totalFees != null
                  ? s.totalFees
                  : sched.totalDue != null
                  ? sched.totalDue
                  : 0;
              const rawPaidAmount =
                s.paidAmount != null
                  ? s.paidAmount
                  : s.paid != null
                  ? s.paid
                  : (pm && pm.totalPaid) != null
                  ? pm && pm.totalPaid
                  : sched.totalPaid != null
                  ? sched.totalPaid
                  : 0;

              // Convert strictly with Number(); if Number() gives NaN, fallback to toSafeNumber
              const totalFeeVal = (() => {
                const n = Number(rawTotalFee);
                return isFinite(n) ? n : toSafeNumber(rawTotalFee);
              })();
              const paidVal = (() => {
                const n = Number(rawPaidAmount);
                return isFinite(n) ? n : toSafeNumber(rawPaidAmount);
              })();

              // If totalFee is 0 or falsy, show 0%; otherwise compute percentage
              let paymentRate = 0;
              if (totalFeeVal > 0) {
                const paymentRateRaw = (paidVal / totalFeeVal) * 100;
                paymentRate = Math.round(paymentRateRaw);
                paymentRate = Math.max(0, Math.min(100, paymentRate));
              } else {
                paymentRate = 0;
              }

              const label = `${paymentRate}% 支払い済み`;

              if (DEBUG)
                console.log(
                  `[CourseDetail] payment calc for ${s.studentId} doc=${s.id}`,
                  {
                    rawTotalFee,
                    rawPaidAmount,
                    totalFeeVal,
                    paidVal,
                    paymentRate,
                  }
                );
              // (baseTotal calculation removed — not used in this view)

              return (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/student/dashboard/${s.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.studentId}
                    </Link>
                  </td>
                  <td>{s.displayName || s.name || "-"}</td>
                  <td>{s.email || "-"}</td>
                  <td>{s.startMonth || s.start_date || "-"}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        className={`status-badge ${
                          paymentRate >= 100
                            ? "badge-success"
                            : paymentRate > 0
                            ? "badge-partial"
                            : "badge-unset"
                        }`}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          width: "160px",
                          background: "#e5e7eb",
                          height: "8px",
                          borderRadius: "9999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${paymentRate}%`,
                            background: "#3b82f6",
                            height: "100%",
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    {/* <Link
                      href={`/teacher/dashboard/course/${id}/student/${s.id}`}
                      className="mr-2"
                    >
                      編集
                    </Link> */}
                    <button
                      onClick={() => handleDeleteStudent(s.id)}
                      className="ml-2 text-red-600"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
