# Cloud Functions for real-time course student counts

This folder contains Firebase Cloud Functions that maintain `courses/{courseId}.students` (学生数) in real-time.

Recommended data model:

- `courses/{courseId}`: course documents. Contains `students` (number) updated by functions.
- `users/{userId}`: student accounts. When deleted, their enrollments are removed.
- `enrollments/{courseId_studentId}`: one document per (courseId, studentId) pair. Fields: `courseId`, `studentId`, `status` ('enrolled' | 'dropped'), timestamps.

Functions:

- `enrollmentCreated`: increments the course `students` when a new enrollment is created (status is `enrolled` or missing).
- `enrollmentDeleted`: decrements the course `students` when an enrollment is deleted.
- `enrollmentUpdated`: adjusts the counter when `status` toggles.
- `userDeleted`: cascades deletion of all enrollments for the deleted user. The counter adjustment is handled by `enrollmentDeleted`.

Notes:

- Use the document id pattern `courseId_studentId` to enforce uniqueness per pair and avoid double-counting.
- All increments/decrements use atomic `FieldValue.increment`, so concurrent updates are safe.

Local development (optional):

```powershell
# install deps
cd functions
npm install

# run only the functions emulator (requires firebase-tools)
firebase emulators:start --only functions
```

Deployment:

```powershell
cd functions
npm install
firebase deploy --only functions
```
