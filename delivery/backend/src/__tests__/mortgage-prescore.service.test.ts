import { describe, expect, it } from 'vitest';
import {
  deriveOverallReadiness,
  runMortgagePreScore,
  type MortgageProgramRuleCard,
  type VerifiedMortgageSnapshot,
} from '../lib/mortgage-prescore.service';

const snapshot = (overrides: Partial<VerifiedMortgageSnapshot> = {}): VerifiedMortgageSnapshot => ({
  id: 'snap-1',
  inputHash: 'input-hash-1',
  asOf: '2026-08-24T00:00:00.000Z',
  consentStatus: 'ACTIVE',
  criticalDataResolved: true,
  incomeStreams: [
    { fingerprint: 'salary-1', amount: '600000', verified: true, eligible: true },
    { fingerprint: 'salary-2', amount: '400000', verified: true, eligible: true },
  ],
  facilities: [
    { fingerprint: 'loan-a', monthlyPayment: '120000', applicable: true },
    { fingerprint: 'loan-b', monthlyPayment: '80000', applicable: true },
    { fingerprint: 'joint-1', monthlyPayment: '50000', applicable: true },
  ],
  creditDiscipline: 'LOW_RISK',
  incomeStability: 'HIGH',
  dataConfidence: 'HIGH',
  ...overrides,
});

const rule = (overrides: Partial<MortgageProgramRuleCard> = {}): MortgageProgramRuleCard => ({
  programId: 'program-1',
  ruleVersionId: 'rule-1',
  status: 'ACTIVE',
  validFrom: '2026-08-01T00:00:00.000Z',
  validTo: '2026-09-01T00:00:00.000Z',
  sourceStatus: 'CONFIRMED',
  annualNominalRate: '0',
  termMonths: 120,
  debtRatio: '0.5',
  minDownPaymentRatio: '0.2',
  maxLtv: '0.8',
  maxLoan: '50000000',
  hardFilterFailures: [],
  ...overrides,
});

describe('runMortgagePreScore', () => {
  it('deduplicates economic income and joint facilities before calculating GC-06', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [
          { fingerprint: 'salary-1', amount: '600000', verified: true, eligible: true },
          { fingerprint: 'salary-2', amount: '400000', verified: true, eligible: true },
          { fingerprint: 'salary-1', amount: '600000', verified: true, eligible: true },
        ],
        facilities: [
          { fingerprint: 'loan-a', monthlyPayment: '120000', applicable: true },
          { fingerprint: 'loan-b', monthlyPayment: '80000', applicable: true },
          { fingerprint: 'joint-1', monthlyPayment: '50000', applicable: true },
          { fingerprint: 'joint-1', monthlyPayment: '50000', applicable: true },
        ],
      }),
      programs: [rule()],
    });

    expect(result.trace.eligibleIncome).toBe('1000000');
    expect(result.trace.existingLoad).toBe('250000');
    expect(result.assessments[0].availablePayment).toBe('250000');
    expect(result.reasonCodes).toContain('DUPLICATE_INCOME_SUPPRESSED');
  });

  it('blocks a conflicting duplicate instead of silently choosing one value', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [
          { fingerprint: 'salary-1', amount: '600000', verified: true, eligible: true },
          { fingerprint: 'salary-1', amount: '650000', verified: true, eligible: true },
        ],
      }),
      programs: [rule()],
    });

    expect(result.overallReadiness).toBe('INSUFFICIENT_DATA');
    expect(result.reasonCodes).toContain('CRITICAL_DATA_MISSING');
    expect(result.trace.conflictingIncomeFingerprints).toEqual(['salary-1']);
    expect(result.assessments).toEqual([]);
  });

  it('blocks negative financial inputs', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [
          { fingerprint: 'salary-1', amount: '-1', verified: true, eligible: true },
        ],
      }),
      programs: [rule()],
    });

    expect(result.reasonCodes).toContain('CALCULATION_INPUT_INVALID');
    expect(result.assessments).toEqual([]);
  });

  it('fails closed for malformed rule numbers and impossible property values', () => {
    expect(() => runMortgagePreScore({
      snapshot: snapshot({ property: { purchasePrice: '-1', appraisalValue: '100', downPaymentCash: '0', inventoryStatus: 'AVAILABLE' } }),
      programs: [rule()],
    })).not.toThrow();
    const invalidProperty = runMortgagePreScore({
      snapshot: snapshot({ property: { purchasePrice: '-1', appraisalValue: '100', downPaymentCash: '0', inventoryStatus: 'AVAILABLE' } }),
      programs: [rule()],
    });
    expect(invalidProperty.assessments[0].affordability).toBe('UNKNOWN');
    expect(invalidProperty.assessments[0].reasonCodes).toContain('CALCULATION_INPUT_INVALID');

    const invalidRule = runMortgagePreScore({ snapshot: snapshot(), programs: [rule({ debtRatio: '1.2', annualNominalRate: 'not-a-number' })] });
    expect(invalidRule.assessments[0].eligibility).toBe('UNKNOWN');
    expect(invalidRule.assessments[0].reasonCodes).toContain('CALCULATION_INPUT_INVALID');
  });
  it('keeps stale rules UNKNOWN and out of the matched list', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot(),
      programs: [rule({ validTo: '2026-08-23T23:59:59.000Z' })],
    });

    expect(result.assessments[0].eligibility).toBe('UNKNOWN');
    expect(result.assessments[0].reasonCodes).toContain('PROGRAM_RULE_STALE');
    expect(result.matchedProgramIds).toEqual([]);
    expect(result.unresolvedProgramIds).toEqual(['program-1']);
  });

  it('keeps unconfirmed mandatory rules UNKNOWN', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot(),
      programs: [rule({ sourceStatus: 'UNKNOWN' })],
    });

    expect(result.assessments[0].eligibility).toBe('UNKNOWN');
    expect(result.assessments[0].reasonCodes).toContain('PROGRAM_RULE_UNKNOWN');
  });

  it('uses the audited annual nominal fraction without dividing it by 100 again', () => {
    const principal = '12419112.462224308641';
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [{ fingerprint: 'salary', amount: '1000000', verified: true, eligible: true }],
        facilities: [],
        property: {
          purchasePrice: principal,
          appraisalValue: principal,
          downPaymentCash: '0',
          inventoryStatus: 'AVAILABLE',
        },
      }),
      programs: [rule({
        annualNominalRate: '0.18',
        termMonths: 180,
        debtRatio: '0.2',
        minDownPaymentRatio: '0',
        maxLtv: '1',
      })],
    });

    expect(Number(result.assessments[0].proposedPayment)).toBeCloseTo(200000, 2);
  });

  it('classifies a feasible exact down-payment action as CONDITIONAL, not FAIL', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [{ fingerprint: 'salary', amount: '500000', verified: true, eligible: true }],
        facilities: [],
        property: {
          purchasePrice: '40000000',
          appraisalValue: '40000000',
          downPaymentCash: '8000000',
          inventoryStatus: 'AVAILABLE',
        },
      }),
      programs: [rule({
        debtRatio: '0.5',
        minDownPaymentRatio: '0.2',
        maxLtv: '1',
      })],
    });

    const assessment = result.assessments[0];
    expect(assessment.affordability).toBe('CONDITIONAL');
    expect(assessment.downPaymentShortfall).toBe('2000000');
    expect(assessment.requiredActions[0]?.delta).toBe('2000000');
  });

  it('keeps affordability UNKNOWN when appraisal is missing', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        property: {
          purchasePrice: '40000000',
          appraisalValue: null,
          downPaymentCash: '12000000',
          inventoryStatus: 'AVAILABLE',
        },
      }),
      programs: [rule()],
    });

    expect(result.assessments[0].affordability).toBe('UNKNOWN');
    expect(result.assessments[0].reasonCodes).toContain('CRITICAL_DATA_MISSING');
    expect(result.matchedProgramIds).toEqual([]);
    expect(result.unresolvedProgramIds).toEqual(['program-1']);
  });

  it('returns an exact conditional down-payment shortfall for GC-05', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({
        incomeStreams: [{ fingerprint: 'salary', amount: '5000000', verified: true, eligible: true }],
        facilities: [],
        property: {
          purchasePrice: '40000000',
          appraisalValue: '36000000',
          downPaymentCash: '8000000',
          inventoryStatus: 'AVAILABLE',
        },
      }),
      programs: [rule()],
    });

    const assessment = result.assessments[0];
    expect(assessment.affordability).toBe('CONDITIONAL');
    expect(assessment.requiredDownPayment).toBe('11200000');
    expect(assessment.downPaymentShortfall).toBe('3200000');
    expect(assessment.requiredActions).toContainEqual({
      field: 'property.downPaymentCash',
      target: '11200000',
      delta: '3200000',
      evidence: 'VERIFIED_FUNDS',
    });
  });

  it('excludes sourced hard failures from matching', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot(),
      programs: [rule({ hardFilterFailures: ['AGE_AT_MATURITY_EXCEEDED'] })],
    });

    expect(result.assessments[0].eligibility).toBe('FAIL');
    expect(result.excludedProgramIds).toEqual(['program-1']);
    expect(result.matchedProgramIds).toEqual([]);
  });

  it('blocks calculation when consent is not active', () => {
    const result = runMortgagePreScore({
      snapshot: snapshot({ consentStatus: 'REVOKED' }),
      programs: [rule()],
    });

    expect(result.overallReadiness).toBe('INSUFFICIENT_DATA');
    expect(result.reasonCodes).toContain('CONSENT_REVOKED');
    expect(result.assessments).toEqual([]);
  });

  it('returns the same output hash regardless of rule-card input order', () => {
    const first = rule({ programId: 'program-1', ruleVersionId: 'rule-1' });
    const second = rule({ programId: 'program-2', ruleVersionId: 'rule-2' });

    const forward = runMortgagePreScore({ snapshot: snapshot(), programs: [first, second] });
    const reversed = runMortgagePreScore({ snapshot: snapshot(), programs: [second, first] });

    expect(forward.outputHash).toBe(reversed.outputHash);
    expect(forward.assessments.map((item) => item.programId)).toEqual(['program-1', 'program-2']);
  });
});

describe('deriveOverallReadiness', () => {
  it('uses the audited matrix instead of averaging axes', () => {
    expect(deriveOverallReadiness({
      hasSuitableProgram: true,
      hasConditionalProgram: false,
      affordability: 'PASS',
      creditDiscipline: 'LOW_RISK',
      incomeStability: 'HIGH',
      dataConfidence: 'HIGH',
      criticalBlocker: false,
    })).toBe('HIGH');

    expect(deriveOverallReadiness({
      hasSuitableProgram: false,
      hasConditionalProgram: false,
      affordability: 'FAIL',
      creditDiscipline: 'LOW_RISK',
      incomeStability: 'HIGH',
      dataConfidence: 'HIGH',
      criticalBlocker: false,
    })).toBe('LOW');

    expect(deriveOverallReadiness({
      hasSuitableProgram: true,
      hasConditionalProgram: false,
      affordability: 'PASS',
      creditDiscipline: 'LOW_RISK',
      incomeStability: 'HIGH',
      dataConfidence: 'HIGH',
      criticalBlocker: true,
    })).toBe('INSUFFICIENT_DATA');
  });
});