// Cloud Functions to keep course.studentCount (students) accurate in real-time.
// Data model (recommended):
// - Collection: enrollments/{enrollmentId}
//   enrollmentId = `${courseId}_${studentId}` to guarantee uniqueness per pair
//   Fields: { courseId: string, studentId: string, status: 'enrolled'|'dropped', createdAt, updatedAt }
// - Collection: courses/{courseId}
//   Fields: { students: number, ... }
// - Collection: users/{userId}
//   On delete, cascade delete enrollments where studentId == userId

import admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function incrementCourse(courseId, delta) {
  if (!courseId || !Number.isInteger(delta)) return;
  const ref = db.doc(`courses/${courseId}`);
  await ref.set(
    { students: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function isEnrolledStatus(data) {
  // treat missing status as enrolled by default
  return (data?.status ?? 'enrolled') === 'enrolled';
}

export const enrollmentCreated = onDocumentCreated('enrollments/{enrollmentId}', async (event) => {
  const snap = event.data; // QueryDocumentSnapshot
  if (!snap) return;
  const data = snap.data();
  const courseId = data?.courseId;

  try {
    if (isEnrolledStatus(data)) {
      await incrementCourse(courseId, +1);
      logger.info('Incremented students for course on enrollmentCreated', { courseId });
    }
  } catch (e) {
    logger.error('enrollmentCreated failed', { courseId, error: e });
  }
});

export const enrollmentDeleted = onDocumentDeleted('enrollments/{enrollmentId}', async (event) => {
  const snap = event.data; // QueryDocumentSnapshot before delete
  if (!snap) return;
  const data = snap.data();
  const courseId = data?.courseId;

  try {
    if (isEnrolledStatus(data)) {
      await incrementCourse(courseId, -1);
      logger.info('Decremented students for course on enrollmentDeleted', { courseId });
    }
  } catch (e) {
    logger.error('enrollmentDeleted failed', { courseId, error: e });
  }
});

export const enrollmentUpdated = onDocumentUpdated('enrollments/{enrollmentId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  const courseId = after.courseId || before.courseId;
  const beforeEnrolled = isEnrolledStatus(before);
  const afterEnrolled = isEnrolledStatus(after);

  if (beforeEnrolled === afterEnrolled) return;

  try {
    await incrementCourse(courseId, afterEnrolled ? +1 : -1);
    logger.info('Adjusted students for course on enrollmentUpdated', { courseId, afterEnrolled });
  } catch (e) {
    logger.error('enrollmentUpdated failed', { courseId, error: e });
  }
});

// Cascade clean-up: when a user is deleted, remove their enrollments.
// Rely on enrollmentDeleted to decrement course counts atomically.
export const userDeleted = onDocumentDeleted('users/{userId}', async (event) => {
  const { userId } = event.params;
  try {
    const enrollmentsSnap = await db
      .collection('enrollments')
      .where('studentId', '==', userId)
      .get();

    if (enrollmentsSnap.empty) return;

    // delete in batches of 500
    const chunks = [];
    let current = [];
    enrollmentsSnap.docs.forEach((doc, idx) => {
      current.push(doc.ref);
      if (current.length === 500 || idx === enrollmentsSnap.docs.length - 1) {
        chunks.push(current);
        current = [];
      }
    });

    for (const refs of chunks) {
      const batch = db.batch();
      refs.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    logger.info('Deleted enrollments for deleted user', { userId, count: enrollmentsSnap.size });
  } catch (e) {
    logger.error('userDeleted cleanup failed', { userId, error: e });
  }
});
