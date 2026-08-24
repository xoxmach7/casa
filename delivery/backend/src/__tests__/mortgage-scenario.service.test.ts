import { describe, expect, it } from 'vitest';
import {
  previewMortgageScenario,
  ScenarioValidationError,
} from '../lib/mortgage-scenario.service';
import type {
  MortgageProgramRuleCard,
  VerifiedMortgageSnapshot,
} from '../lib/mortgage-prescore.service';

const snapshot: VerifiedMortgageSnapshot = {
  id: 'snap_1',
  inputHash: 'hash_1',
  asOf: '2026-08-24T00:00:00.000Z',
  consentStatus: 'ACTIVE',
  criticalDataResolved: true,
  incomeStreams: [{ fingerprint: 'salary', amount: '500000', verified: true, eligible: true }],
  facilities: [{ fingerprint: 'loan_1', monthlyPayment: '100000', applicable: true }],
  property: {
    purchasePrice: '40000000',
    appraisalValue: '40000000',
    downPaymentCash: '8000000',
    inventoryStatus: 'AVAILABLE',
  },
  creditDiscipline: 'LOW_RISK',
  incomeStability: 'HIGH',
  dataConfidence: 'HIGH',
};

const program: MortgageProgramRuleCard = {
  programId: 'program_1',
  ruleVersionId: 'rule_1',
  status: 'ACTIVE',
  validFrom: '2026-08-01T00:00:00.000Z',
  validTo: '2026-09-01T00:00:00.000Z',
  sourceStatus: 'CONFIRMED',
  annualNominalRate: '0',
  termMonths: 240,
  debtRatio: '0.5',
  minDownPaymentRatio: '0.2',
  maxLtv: '1',
  maxLoan: '30000000',
  hardFilterFailures: [],
};

describe('mortgage scenario preview', () => {
  it('applies exact additional down payment copy-on-write', () => {
    const result = previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{ type: 'increase_down_payment', additionalDownPayment: '2000000' }],
    });

    expect(snapshot.property?.downPaymentCash).toBe('8000000');
    expect(result.snapshot.property?.downPaymentCash).toBe('10000000');
    expect(result.after.assessments[0].affordability).toBe('PASS');
    expect(result.openedProgramIds).toEqual(['program_1']);
  });

  it('requires verified payoff before removing an obligation', () => {
    expect(() => previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{ type: 'close_obligation', facilityFingerprint: 'loan_1', payoffVerified: false }],
    })).toThrowError(ScenarioValidationError);
  });

  it('counts additional income only when verified and accepted by a program', () => {
    expect(() => previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{
        type: 'increase_confirmed_income',
        fingerprint: 'side_income',
        amount: '200000',
        verified: true,
        programAcceptanceStatus: 'UNKNOWN',
      }],
    })).toThrowError(ScenarioValidationError);

    const accepted = previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{
        type: 'increase_confirmed_income',
        fingerprint: 'side_income',
        amount: '200000',
        verified: true,
        programAcceptanceStatus: 'ACCEPTED',
      }],
    });
    expect(accepted.snapshot.incomeStreams).toHaveLength(2);
  });

  it('requires a verified refinancing offer and discloses worse total cost', () => {
    const result = previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{
        type: 'refinance_high_rate_debt',
        facilityFingerprint: 'loan_1',
        verifiedOffer: true,
        newMonthlyPayment: '70000',
        totalCostDifference: '500000',
      }],
    });

    expect(result.warnings).toContain('TOTAL_COST_INCREASE');
    expect(result.snapshot.facilities[0].monthlyPayment).toBe('70000');
  });

  it('does not lower debt load when early repayment only reduces term', () => {
    const result = previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{ type: 'partial_early_repayment', facilityFingerprint: 'loan_1', verifiedSchedule: true, recalculationMode: 'reduce_term', newMonthlyPayment: '1' }],
    });
    expect(result.snapshot.facilities[0].monthlyPayment).toBe('100000');
    expect(result.warnings).toContain('TERM_REDUCTION_DOES_NOT_PROVE_LOWER_DEBT_LOAD');
  });

  it('does not report a newly opened program from a high-risk co-borrower', () => {
    const result = previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [{ type: 'add_co_borrower', snapshot: { ...snapshot, id: 'co_1', inputHash: 'co_hash', incomeStreams: [{ fingerprint: 'co_salary', amount: '1000000', verified: true, eligible: true }], facilities: [], creditDiscipline: 'HIGH_RISK' } }],
    });
    expect(result.snapshot.creditDiscipline).toBe('HIGH_RISK');
    expect(result.after.overallReadiness).toBe('LOW');
    expect(result.openedProgramIds).toEqual([]);
  });
  it('enforces the three-change combination policy', () => {
    expect(() => previewMortgageScenario({
      snapshot,
      programs: [program],
      changes: [
        { type: 'increase_down_payment', additionalDownPayment: '1' },
        { type: 'lower_property_budget', newPropertyPrice: '39000000' },
        { type: 'close_obligation', facilityFingerprint: 'loan_1', payoffVerified: true },
        { type: 'wait_for_history', targetDate: '2026-10-01', reason: 'history_window' },
      ],
    })).toThrowError(ScenarioValidationError);
  });
});