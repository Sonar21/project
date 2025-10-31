// Simple in-memory course -> tuition mapping for demo purposes
const courses = new Map([
  ["cs", { code: "cs", name: "Web Programming", tuition: 900000, tuitionByYear: null }],
  ["hm", { code: "hm", name: "Hotel Management", tuition: 750000, tuitionByYear: null }],
  ["dm", { code: "dm", name: "Digital Marketing", tuition: 680000, tuitionByYear: null }],
]);

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export function listCourses() {
  return Array.from(courses.values());
}

export function getCourse(code) {
  if (!code) return null;
  return courses.get(String(code).toLowerCase()) || null;
}

export function getTuitionForCourse(code) {
  const c = getCourse(code);
  return c ? c.tuition : null;
}

export function addCourse(name, tuition) {
  // If a course with the same normalized name exists, update it instead
  const normalized = slugify(name || "course");
  for (const [key, val] of courses.entries()) {
    if (slugify(val.name) === normalized) {
      // update tuition if provided
      const t = Number(String(tuition).replace(/[^0-9]/g, ""));
      if (!Number.isNaN(t)) val.tuition = t;
      val.name = name || val.name;
      courses.set(key, val);
      return val;
    }
  }

  // create new code when no existing match
  const base = normalized;
  let code = base;
  let i = 1;
  while (courses.has(code)) {
    code = `${base}-${i++}`;
  }
  const t = Number(String(tuition).replace(/[^0-9]/g, "")) || 0;
  const c = { code, name, tuition: t, tuitionByYear: null };
  courses.set(code, c);
  return c;
}

export function updateCourse(code, { name, tuition }) {
  const key = String(code).toLowerCase();
  const existing = courses.get(key);
  if (!existing) return null;
  if (name) existing.name = name;
  if (tuition !== undefined)
    existing.tuition =
      Number(String(tuition).replace(/[^0-9]/g, "")) || existing.tuition;
  // allow updating tuitionByYear object
  if (arguments[1] && arguments[1].tuitionByYear !== undefined) {
    existing.tuitionByYear = arguments[1].tuitionByYear || null;
  }
  courses.set(key, existing);
  return existing;
}

export function deleteCourse(code) {
  const key = String(code).toLowerCase();
  return courses.delete(key);
}
