// Simple in-memory course -> tuition mapping for demo purposes
// const courses = new Map([
//   ["cs", { code: "cs", name: "Web Programming", tuition: 900000, tuitionByYear: null }],
//   ["hm", { code: "hm", name: "Hotel Management", tuition: 750000, tuitionByYear: null }],
//   ["dm", { code: "dm", name: "Digital Marketing", tuition: 680000, tuitionByYear: null }],
// ]);

function slugify(name) {
  const s = String(name || "").trim();
  // Prefer ASCII words if present (e.g. "Web プログラミング" -> "web")
  const asciiMatch = s.match(/[A-Za-z0-9]+/g);
  if (asciiMatch && asciiMatch.length > 0) {
    // Join multiple ASCII words with '-' so multi-word names keep readable slugs
    return String(asciiMatch.join("-")).toLowerCase().slice(0, 40);
  }

  // Fallback: create a conservative slug by replacing non-alphanum with '-' and
  // trimming extra hyphens. This will often become empty for non-latin names,
  // so ensure we never return an empty string by falling back to a timestamp.
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  if (slug) return slug;

  // Last-resort fallback: deterministic-ish unique key based on timestamp.
  return `course-${Date.now().toString(36)}`.slice(0, 40);
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
