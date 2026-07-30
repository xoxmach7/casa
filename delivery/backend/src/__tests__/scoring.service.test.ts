import { describe, it, expect } from 'vitest';
import { computeScoring, matchPrograms } from '../lib/scoring.service';

describe('computeScoring', () => {
  it('gives a high score and HIGH approval likelihood for a strong profile', () => {
    const result = computeScoring({
      monthlyIncome: 500_000,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 50_000, // exactly the expected 10% ratio
      existingMonthlyDebt: 0,
      downPayment: 5_000_000,
    });

    expect(result.scoreValue).toBe(100);
    expect(result.approvalLikelihood).toBe('HIGH');
    expect(result.maxMonthlyPayment).toBe(250_000);
    expect(result.maxLoanAmount).toBeGreaterThan(0);
    expect(result.maxPropertyPrice).toBe(result.maxLoanAmount + 5_000_000);
    expect(result.advice.some((a) => a.includes('хорошая'))).toBe(true);
  });

  it('gives a low score and LOW approval likelihood for a bad-credit, high-debt profile', () => {
    const result = computeScoring({
      monthlyIncome: 300_000,
      creditHistoryStatus: 'BAD',
      avgMonthlyPension: 0,
      existingMonthlyDebt: 250_000,
      downPayment: 0,
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
      downPayment: 1_000_000,
    });

    expect(result.maxMonthlyPayment).toBe(0);
    expect(result.maxLoanAmount).toBe(0);
    expect(result.maxPropertyPrice).toBe(1_000_000); // just the down payment, no loan
  });

  it('flags low pension contributions relative to income', () => {
    const result = computeScoring({
      monthlyIncome: 500_000,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 5_000,
      existingMonthlyDebt: 0,
      downPayment: 0,
    });

    expect(result.advice.some((a) => a.includes('Пенсионные отчисления низкие'))).toBe(true);
  });

  it('returns INSUFFICIENT_DATA when there is no income or pension signal at all', () => {
    const result = computeScoring({
      monthlyIncome: 0,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 0,
      existingMonthlyDebt: 0,
      downPayment: 2_000_000,
    });

    expect(result.approvalLikelihood).toBe('INSUFFICIENT_DATA');
    expect(result.maxLoanAmount).toBe(0);
    expect(result.maxPropertyPrice).toBe(2_000_000);
    expect(result.advice.some((a) => a.includes('Недостаточно данных'))).toBe(true);
  });

  it('still scores when income is zero but pension contributions give an income signal', () => {
    const result = computeScoring({
      monthlyIncome: 0,
      creditHistoryStatus: 'GOOD',
      avgMonthlyPension: 40_000,
      existingMonthlyDebt: 0,
      downPayment: 0,
    });

    expect(result.approvalLikelihood).not.toBe('INSUFFICIENT_DATA');
  });
});

describe('matchPrograms', () => {
  const programs = [
    { id: 'p1', bankName: 'Bank A', programName: 'Standard', interestRate: 18, maxTerm: 240 },
    { id: 'p2', bankName: 'Bank B', programName: 'Cheap', interestRate: 10, maxTerm: 240 },
    { id: 'p3', bankName: 'Bank C', programName: 'Short', interestRate: 10, maxTerm: 60 },
  ];

  it('marks every program UNSUITABLE (with a reason) when the client cannot afford anything', () => {
    const matched = matchPrograms(programs, 0, 0);
    expect(matched).toHaveLength(3);
    expect(matched.every((m) => m.suitability === 'UNSUITABLE')).toBe(true);
    expect(matched.every((m) => m.reason.length > 0)).toBe(true);
  });

  it('classifies affordable programs as SUITABLE and pricier ones as UNSUITABLE, sorted best-first', () => {
    // At 10,000,000 loan / 240 months, ~18% is too expensive for a small budget,
    // ~10%/240mo fits, ~10%/60mo (much higher monthly payment) does not.
    const matched = matchPrograms(programs, 10_000_000, 100_000);

    expect(matched[0]).toMatchObject({ id: 'p2', suitability: 'SUITABLE' });
    expect(matched.find((m) => m.id === 'p1')?.suitability).not.toBe('SUITABLE');
    expect(matched.find((m) => m.id === 'p3')?.suitability).not.toBe('SUITABLE');
  });

  it('returns every program classified, never filtering any out', () => {
    const matched = matchPrograms(programs, 5_000_000, 1_000_000);
    expect(matched).toHaveLength(programs.length);
  });

  it('sorts suitable matches ahead of conditionally-suitable/unsuitable ones', () => {
    const matched = matchPrograms(programs, 10_000_000, 100_000);
    const rank: Record<string, number> = { SUITABLE: 0, CONDITIONALLY_SUITABLE: 1, UNSUITABLE: 2 };
    for (let i = 1; i < matched.length; i++) {
      expect(rank[matched[i - 1].suitability]).toBeLessThanOrEqual(rank[matched[i].suitability]);
    }
  });
});
