import { describe, it, expect } from 'vitest';
import { computeScoring, matchPrograms } from '../lib/scoring.service';

describe('computeScoring', () => {
  it('gives a high score and HIGH approval likelihood for a strong profile', () => {
    const result = computeScoring({
      monthlyIncome: 500_000,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 50_000, // exactly the expected 10% ratio
      existingMonthlyDebt: 0,
    });

    expect(result.scoreValue).toBe(100);
    expect(result.approvalLikelihood).toBe('HIGH');
    expect(result.maxMonthlyPayment).toBe(250_000);
    expect(result.maxLoanAmount).toBeGreaterThan(0);
    expect(result.advice.some((a) => a.includes('хорошая'))).toBe(true);
  });

  it('gives a low score and LOW approval likelihood for a bad-credit, high-debt profile', () => {
    const result = computeScoring({
      monthlyIncome: 300_000,
      creditHistoryStatus: 'BAD',
      avgMonthlyPension: 0,
      existingMonthlyDebt: 250_000,
    });

    expect(result.scoreValue).toBeLessThan(40);
    expect(result.approvalLikelihood).toBe('LOW');
    expect(result.advice.some((a) => a.includes('просрочк'))).toBe(true);
  });

  it('caps affordability at zero when existing debt already exceeds the debt-service ceiling', () => {
    const result = computeScoring({
      monthlyIncome: 200_000,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 20_000,
      existingMonthlyDebt: 300_000,
    });

    expect(result.maxMonthlyPayment).toBe(0);
    expect(result.maxLoanAmount).toBe(0);
  });

  it('flags low pension contributions relative to income', () => {
    const result = computeScoring({
      monthlyIncome: 500_000,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 5_000,
      existingMonthlyDebt: 0,
    });

    expect(result.advice.some((a) => a.includes('Пенсионные отчисления низкие'))).toBe(true);
  });
});

describe('matchPrograms', () => {
  const programs = [
    { id: 'p1', bankName: 'Bank A', programName: 'Standard', interestRate: 18, maxTerm: 240 },
    { id: 'p2', bankName: 'Bank B', programName: 'Cheap', interestRate: 10, maxTerm: 240 },
    { id: 'p3', bankName: 'Bank C', programName: 'Short', interestRate: 10, maxTerm: 60 },
  ];

  it('returns an empty list when the client cannot afford anything', () => {
    expect(matchPrograms(programs, 0, 0)).toEqual([]);
  });

  it('filters out programs whose payment exceeds the affordable ceiling, sorted by rate', () => {
    // At 10,000,000 loan / 240 months, ~18% is too expensive for a small budget,
    // ~10%/240mo fits, ~10%/60mo (much higher monthly payment) does not.
    const matched = matchPrograms(programs, 10_000_000, 100_000);

    expect(matched.map((m) => m.id)).toEqual(['p2']);
  });

  it('sorts multiple affordable matches by interest rate ascending', () => {
    const matched = matchPrograms(programs, 5_000_000, 1_000_000);

    expect(matched[0].interestRate).toBeLessThanOrEqual(matched[matched.length - 1].interestRate);
  });
});
