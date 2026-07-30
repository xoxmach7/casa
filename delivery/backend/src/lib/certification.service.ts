// Pure logic for deciding when a broker earns CERTIFIED status (ТЗ раздел
// 11/12): once every active course has a completed CourseProgress row for
// that user. Kept separate from the route so it's trivially unit-testable
// without touching Prisma.

export function isEligibleForCertification(activeCourseIds: string[], completedCourseIds: string[]): boolean {
  if (activeCourseIds.length === 0) return false;
  const completed = new Set(completedCourseIds);
  return activeCourseIds.every((id) => completed.has(id));
}

export interface GradedTestResult {
  score: number; // 0-100
  passed: boolean;
}

export function gradeTest(
  questions: { correctIndex: number }[],
  answers: number[],
  passScore: number
): GradedTestResult {
  if (questions.length === 0) return { score: 0, passed: false };
  const correctCount = questions.reduce(
    (count, q, i) => (answers[i] === q.correctIndex ? count + 1 : count),
    0
  );
  const score = Math.round((correctCount / questions.length) * 100);
  return { score, passed: score >= passScore };
}
