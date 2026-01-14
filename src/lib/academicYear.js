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
  if (!Number.isFinite(entranceYear)) {
    return { academicYear, gradeNum: null, gradeJP: null, gradeEN: null };
  }

  const gradeNum = academicYear - entranceYear + 1;
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
