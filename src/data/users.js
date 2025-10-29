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
  course: "cs",
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

export function createOrGetUserByEmail(email, name) {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  // create new student user; studentId from local part of email
  const local = String(email).split("@")[0].toLowerCase();
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
    course: null,
  };
  users.set(local, newUser);
  return newUser;
}

// Determine role by email patterns for osfl.ac.jp
// - Student: local part matches Wxxxxx or Kxxxxx (starts with W or K followed by digits)
// - Teacher: local part is alphabetic name (no digits)
// Returns either 'student' or 'teacher' (defaults to 'student')
export function determineRoleByEmail(email) {
  if (!email) return "student";
  const parts = String(email).toLowerCase().split("@");
  if (parts.length !== 2) return "student";
  const [local, domain] = parts;
  if (!domain.endsWith("osfl.ac.jp")) return "student";

  // Student pattern: starts with W or K followed by digits, e.g. W24002 or K12345
  if (/^[wk]\d{1,}$/i.test(local)) return "student";

  // Teacher pattern: alphabetic name without digits
  if (/^[a-z]+$/i.test(local)) return "teacher";

  // Fallback: if contains digits, treat as student, else teacher
  if (/\d/.test(local)) return "student";
  return "teacher";
}

export function listUsers() {
  return Array.from(users.values()).map((u) => ({
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    role: u.role,
    course: u.course || null,
  }));
}

export function setUserCourse(studentId, course) {
  const key = String(studentId).toLowerCase();
  const u = users.get(key);
  if (!u) return null;
  u.course = course;
  users.set(key, u);
  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    role: u.role,
    course: u.course,
  };
}

// Update arbitrary user fields (name, email, course, etc.)
export function updateUser(studentId, fields = {}) {
  const key = String(studentId).toLowerCase();
  const u = users.get(key);
  if (!u) return null;
  // Only allow a small set of updatable fields
  const allowed = ["name", "email", "course", "role"];
  for (const k of Object.keys(fields)) {
    if (!allowed.includes(k)) continue;
    u[k] = fields[k];
  }
  // If email changed, also move map key if needed
  if (fields.email && typeof fields.email === "string") {
    const newLocal = String(fields.email).split("@")[0].toLowerCase();
    if (newLocal && newLocal !== key) {
      users.delete(key);
      u.studentId = newLocal;
      users.set(newLocal, u);
    } else {
      users.set(key, u);
    }
  } else {
    users.set(key, u);
  }

  return {
    id: u.id,
    studentId: u.studentId,
    name: u.name,
    email: u.email,
    role: u.role,
    course: u.course || null,
  };
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

export function validateUserCredentials(studentId, password) {
  const u = getUserByStudentId(studentId);
  if (!u) return null;
  if (u.password === password) return u;
  return null;
}
