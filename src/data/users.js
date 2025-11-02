// In-memory demo user store. For production, replace with a DB.
const users = new Map();

// seed users
users.set("w24002", {
  id: "1",
  studentId: "w24002",
  name: "Student w24002",
  email: "w24002@example.com",
  password: "password",
  role: "student",
});

users.set("admin", {
  id: "2",
  studentId: "admin",
  name: "Admin",
  email: "admin@example.com",
  password: "password",
  role: "teacher",
});

export function getUserByStudentId(studentId) {
  return users.get(String(studentId).toLowerCase());
}

export function getUserByEmail(email) {
  if (!email) return null;
  const e = String(email).toLowerCase();
  for (const u of users.values()) {
    if (String(u.email).toLowerCase() === e) return u;
  }
  return null;
}

export function createOrGetUserByEmail(email, name, nameKana = "") {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  // create new student user; studentId from local part of email
  const local = String(email).split('@')[0].toLowerCase();
  const id = String(Date.now());
  // determine role from email (student vs teacher)
  const role = determineRoleByEmail(email);
  const newUser = {
    id,
    studentId: local,
    name: name || local,
    email,
    password: null,
    role,
  };
  users.set(local, newUser);
  return newUser;
}

// Determine role by email patterns for osfl.ac.jp
// - Student: local part matches Wxxxxx or Kxxxxx (starts with W or K followed by digits)
// - Teacher: local part is alphabetic name (no digits)
// Returns either 'student' or 'teacher' (defaults to 'student')
export function determineRoleByEmail(email) {
  if (!email) return 'student';
  const parts = String(email).toLowerCase().split('@');
  if (parts.length !== 2) return 'student';
  const [local, domain] = parts;
  if (!domain.endsWith('osfl.ac.jp')) return 'student';

  // Student pattern: starts with W or K followed by digits, e.g. W24002 or K12345
  if (/^[wk]\d{1,}$/i.test(local)) return 'student';

  // Teacher pattern: alphabetic name without digits
  if (/^[a-z]+$/i.test(local)) return 'teacher';

  // Fallback: if contains digits, treat as student, else teacher
  if (/\d/.test(local)) return 'student';
  return 'teacher';
}

export function listUsers() {
  return Array.from(users.values()).map((u) => ({
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    courseId: u.courseId || "",
    role: u.role,
  }));
}

export function updateUserRole(studentId, newRole) {
  const key = String(studentId).toLowerCase();
  const u = users.get(key);
  if (!u) return null;
  u.role = newRole;
  users.set(key, u);
  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    role: u.role,
  };
}

// Update arbitrary user fields (used by admin API)
export function updateUser(studentId, updates = {}) {
  const key = String(studentId).toLowerCase();
  const u = users.get(key);
  if (!u) return null;
  // Acceptable updates: courseId (or legacy course), name, email, role
  if (updates.courseId !== undefined) u.courseId = updates.courseId;
  else if (updates.course !== undefined) u.courseId = updates.course;
  if (updates.name !== undefined) u.name = updates.name;
  if (updates.email !== undefined) u.email = updates.email;
  if (updates.role !== undefined) u.role = updates.role;
  users.set(key, u);
  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    courseId: u.courseId || "",
    role: u.role,
  };
}

export function validateUserCredentials(studentId, password) {
  const u = getUserByStudentId(studentId);
  if (!u) return null;
  if (u.password === password) return u;
  return null;
}
