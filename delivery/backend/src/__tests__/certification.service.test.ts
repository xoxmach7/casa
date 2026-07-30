import { describe, it, expect } from 'vitest';
import { isEligibleForCertification, gradeTest } from '../lib/certification.service';

describe('isEligibleForCertification', () => {
  it('returns false when there are no active courses at all', () => {
    expect(isEligibleForCertification([], [])).toBe(false);
  });

  it('returns false when at least one active course is not completed', () => {
    expect(isEligibleForCertification(['c1', 'c2'], ['c1'])).toBe(false);
  });

  it('returns true when every active course is completed', () => {
    expect(isEligibleForCertification(['c1', 'c2'], ['c1', 'c2'])).toBe(true);
  });

  it('ignores completed courses that are no longer active', () => {
    expect(isEligibleForCertification(['c1'], ['c1', 'c_old_inactive'])).toBe(true);
  });
});

describe('gradeTest', () => {
  const questions = [{ correctIndex: 0 }, { correctIndex: 1 }, { correctIndex: 2 }, { correctIndex: 0 }];

  it('scores 100% and passes when all answers are correct', () => {
    const result = gradeTest(questions, [0, 1, 2, 0], 70);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('scores 0% when there are no questions', () => {
    expect(gradeTest([], [], 70)).toEqual({ score: 0, passed: false });
  });

  it('fails when the score is below passScore', () => {
    const result = gradeTest(questions, [0, 0, 0, 0], 70); // 2/4 = 50%
    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('passes exactly at the passScore threshold', () => {
    const result = gradeTest(questions, [0, 1, 2, 1], 75); // 3/4 = 75%
    expect(result.score).toBe(75);
    expect(result.passed).toBe(true);
  });
});
