// Academic year helpers (Japan: April to March)
// getAcademicYear: returns the academic year for the provided date, where
// April marks the start of a new academic year.
export function getAcademicYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.getMonth() + 1; // 1-12
  return month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

// getGradeInfo: derives grade number and labels using the Japanese academic
// year (April start). It accepts an entranceYear like 2025 and a reference
// date (defaults to today).
export function getGradeInfo(entranceYear, date = new Date()) {
  const academicYear = getAcademicYear(date);
  // Normalize entranceYear: accept numeric or numeric-string input.
  const parsed = Number(entranceYear);
  if (!Number.isFinite(parsed)) {
    return { academicYear, gradeNum: null, gradeJP: null, gradeEN: null };
  }

  // If entranceYear is two-digit (e.g. 24), convert to 2000 + yy.
  let normalizedEntranceYear = parsed;
  if (parsed >= 0 && parsed <= 99) {
    normalizedEntranceYear = 2000 + parsed;
  }

  // Ensure a reasonable 4-digit year.
  if (normalizedEntranceYear < 1000) {
    return { academicYear, gradeNum: null, gradeJP: null, gradeEN: null };
  }

  const gradeNum = academicYear - normalizedEntranceYear + 1;
  const gradeMapJP = {
    1: "1年生",
    2: "2年生",
    3: "3年生",
    4: "4年生",
  };
  const gradeJP = gradeMapJP[gradeNum] || `${gradeNum}年生`;

  const ordinal = (n) => {
    if (!Number.isFinite(n)) return `${n}`;
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  };
  const gradeEN = `${ordinal(gradeNum)} Year`;

  return { academicYear, gradeNum, gradeJP, gradeEN };
}

// Helper: derive 4-digit entrance year from a student ID like 'w24011'.
// Returns a number (e.g. 2024) or null if it cannot be parsed.
export function getEntranceYearFromStudentId(studentId) {
  if (typeof studentId !== "string" || studentId.length < 3) return null;
  const yy = Number(studentId.slice(1, 3));
  if (!Number.isFinite(yy)) return null;
  return 2000 + yy;
}
