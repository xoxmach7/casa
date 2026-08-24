import { Prisma } from '@prisma/client';
import { mortgageRequestHash } from './mortgage-case.service';
import {
  runMortgagePreScore,
  type MortgagePreScoreResult,
  type MortgageProgramRuleCard,
  type VerifiedMortgageSnapshot,
} from './mortgage-prescore.service';

const Decimal = Prisma.Decimal;

export class ScenarioValidationError extends Error {
  readonly code = 'SCENARIO_INPUT_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'ScenarioValidationError';
  }
}

export type MortgageScenarioChange =
  | { type: 'increase_down_payment'; additionalDownPayment: string }
  | { type: 'close_obligation'; facilityFingerprint: string; payoffVerified: boolean }
  | {
      type: 'refinance_high_rate_debt';
      facilityFingerprint: string;
      verifiedOffer: boolean;
      newMonthlyPayment: string;
      totalCostDifference: string;
    }
  | {
      type: 'partial_early_repayment';
      facilityFingerprint: string;
      verifiedSchedule: boolean;
      recalculationMode: 'reduce_payment' | 'reduce_term';
      newMonthlyPayment: string;
    }
  | {
      type: 'increase_confirmed_income';
      fingerprint: string;
      amount: string;
      verified: boolean;
      programAcceptanceStatus: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
    }
  | { type: 'lower_property_budget'; newPropertyPrice: string }
  | { type: 'add_co_borrower'; snapshot: VerifiedMortgageSnapshot }
  | { type: 'wait_for_history'; targetDate: string; reason: string };

export interface MortgageScenarioPreviewInput {
  snapshot: VerifiedMortgageSnapshot;
  programs: MortgageProgramRuleCard[];
  changes: MortgageScenarioChange[];
}

function decimal(value: string, field: string): InstanceType<typeof Prisma.Decimal> {
  try {
    const parsed = new Decimal(value);
    if (parsed.isNegative()) throw new Error();
    return parsed;
  } catch {
    throw new ScenarioValidationError(field + ' must be a non-negative decimal');
  }
}

function cloneSnapshot(snapshot: VerifiedMortgageSnapshot): VerifiedMortgageSnapshot {
  return {
    ...snapshot,
    incomeStreams: snapshot.incomeStreams.map((stream) => ({ ...stream })),
    facilities: snapshot.facilities.map((facility) => ({ ...facility })),
    property: snapshot.property ? { ...snapshot.property } : undefined,
  };
}

function passingPrograms(result: MortgagePreScoreResult): Set<string> {
  if (result.overallReadiness === 'LOW' || result.overallReadiness === 'INSUFFICIENT_DATA') {
    return new Set();
  }
  return new Set(
    result.assessments
      .filter((assessment) => assessment.eligibility === 'PASS' && assessment.affordability === 'PASS')
      .map((assessment) => assessment.programId),
  );
}

function worstCreditDiscipline(left: VerifiedMortgageSnapshot['creditDiscipline'], right: VerifiedMortgageSnapshot['creditDiscipline']): VerifiedMortgageSnapshot['creditDiscipline'] {
  const rank = { LOW_RISK: 0, MEDIUM_RISK: 1, HIGH_RISK: 2, INSUFFICIENT_DATA: 3 } as const;
  return rank[left] >= rank[right] ? left : right;
}

function worstIncomeStability(left: VerifiedMortgageSnapshot['incomeStability'], right: VerifiedMortgageSnapshot['incomeStability']): VerifiedMortgageSnapshot['incomeStability'] {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INSUFFICIENT_DATA: 3 } as const;
  return rank[left] >= rank[right] ? left : right;
}

function worstDataConfidence(left: VerifiedMortgageSnapshot['dataConfidence'], right: VerifiedMortgageSnapshot['dataConfidence']): VerifiedMortgageSnapshot['dataConfidence'] {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INSUFFICIENT_DATA: 3 } as const;
  return rank[left] >= rank[right] ? left : right;
}
export function previewMortgageScenario(input: MortgageScenarioPreviewInput) {
  if (input.changes.length === 0) {
    throw new ScenarioValidationError('At least one scenario change is required');
  }
  if (input.changes.length > 3) {
    throw new ScenarioValidationError('A scenario may contain at most three changes');
  }

  const before = runMortgagePreScore({ snapshot: input.snapshot, programs: input.programs });
  const snapshot = cloneSnapshot(input.snapshot);
  const warnings = new Set<string>();
  const requiredDocuments = new Set<string>();

  for (const change of input.changes) {
    switch (change.type) {
      case 'increase_down_payment': {
        if (!snapshot.property) throw new ScenarioValidationError('Property is required');
        const additional = decimal(change.additionalDownPayment, 'additionalDownPayment');
        snapshot.property.downPaymentCash = new Decimal(snapshot.property.downPaymentCash)
          .add(additional)
          .toFixed();
        requiredDocuments.add('VERIFIED_FUNDS');
        break;
      }
      case 'close_obligation': {
        if (!change.payoffVerified) {
          throw new ScenarioValidationError('Verified payoff is required');
        }
        const beforeCount = snapshot.facilities.length;
        snapshot.facilities = snapshot.facilities.filter(
          (facility) => facility.fingerprint !== change.facilityFingerprint,
        );
        if (snapshot.facilities.length === beforeCount) {
          throw new ScenarioValidationError('Obligation was not found');
        }
        requiredDocuments.add('PAYOFF_CONFIRMATION');
        break;
      }
      case 'refinance_high_rate_debt': {
        if (!change.verifiedOffer) {
          throw new ScenarioValidationError('Verified refinancing offer is required');
        }
        const facility = snapshot.facilities.find(
          (item) => item.fingerprint === change.facilityFingerprint,
        );
        if (!facility) throw new ScenarioValidationError('Obligation was not found');
        facility.monthlyPayment = decimal(change.newMonthlyPayment, 'newMonthlyPayment').toFixed();
        if (decimal(change.totalCostDifference, 'totalCostDifference').gt(0)) {
          warnings.add('TOTAL_COST_INCREASE');
        }
        warnings.add('REFINANCING_PRELIMINARY_UNTIL_LENDER_CONFIRMATION');
        requiredDocuments.add('VERIFIED_REFINANCING_OFFER');
        break;
      }
      case 'partial_early_repayment': {
        if (!change.verifiedSchedule) {
          throw new ScenarioValidationError('Verified lender schedule is required');
        }
        const facility = snapshot.facilities.find(
          (item) => item.fingerprint === change.facilityFingerprint,
        );
        if (!facility) throw new ScenarioValidationError('Obligation was not found');
        if (change.recalculationMode === 'reduce_payment') {
          facility.monthlyPayment = decimal(change.newMonthlyPayment, 'newMonthlyPayment').toFixed();
        } else {
          warnings.add('TERM_REDUCTION_DOES_NOT_PROVE_LOWER_DEBT_LOAD');
        }
        requiredDocuments.add('VERIFIED_RECALCULATION_SCHEDULE');
        break;
      }
      case 'increase_confirmed_income': {
        if (!change.verified || change.programAcceptanceStatus !== 'ACCEPTED') {
          throw new ScenarioValidationError('Income must be verified and accepted by the program');
        }
        snapshot.incomeStreams.push({
          fingerprint: change.fingerprint,
          amount: decimal(change.amount, 'amount').toFixed(),
          verified: true,
          eligible: true,
        });
        requiredDocuments.add('INCOME_CONFIRMATION');
        break;
      }
      case 'lower_property_budget': {
        if (!snapshot.property) throw new ScenarioValidationError('Property is required');
        const nextPrice = decimal(change.newPropertyPrice, 'newPropertyPrice');
        if (nextPrice.gte(snapshot.property.purchasePrice)) {
          throw new ScenarioValidationError('New property budget must be lower');
        }
        snapshot.property.purchasePrice = nextPrice.toFixed();
        if (
          snapshot.property.appraisalValue !== null
          && new Decimal(snapshot.property.appraisalValue).gt(nextPrice)
        ) {
          snapshot.property.appraisalValue = nextPrice.toFixed();
        }
        break;
      }
      case 'add_co_borrower': {
        if (
          change.snapshot.consentStatus !== 'ACTIVE'
          || !change.snapshot.criticalDataResolved
        ) {
          throw new ScenarioValidationError('Co-borrower snapshot must be verified and consented');
        }
        snapshot.incomeStreams.push(...change.snapshot.incomeStreams.map((stream) => ({ ...stream })));
        snapshot.facilities.push(...change.snapshot.facilities.map((facility) => ({ ...facility })));
        snapshot.creditDiscipline = worstCreditDiscipline(snapshot.creditDiscipline, change.snapshot.creditDiscipline);
        snapshot.incomeStability = worstIncomeStability(snapshot.incomeStability, change.snapshot.incomeStability);
        snapshot.dataConfidence = worstDataConfidence(snapshot.dataConfidence, change.snapshot.dataConfidence);
        requiredDocuments.add('CO_BORROWER_VERIFIED_SNAPSHOT');
        break;
      }
      case 'wait_for_history': {
        const target = new Date(change.targetDate);
        if (!change.reason || Number.isNaN(target.getTime()) || target <= new Date(snapshot.asOf)) {
          throw new ScenarioValidationError('A future target date and reason are required');
        }
        warnings.add('NO_CURRENT_ELIGIBILITY_CHANGE');
        break;
      }
    }
  }

  snapshot.inputHash = mortgageRequestHash({
    sourceSnapshotId: input.snapshot.id,
    sourceInputHash: input.snapshot.inputHash,
    changes: input.changes,
  });
  const after = runMortgagePreScore({ snapshot, programs: input.programs });
  const beforePass = passingPrograms(before);
  const afterPass = passingPrograms(after);
  const openedProgramIds = [...afterPass].filter((id) => !beforePass.has(id)).sort();
  const closedProgramIds = [...beforePass].filter((id) => !afterPass.has(id)).sort();

  return {
    snapshot,
    before,
    after,
    openedProgramIds,
    closedProgramIds,
    warnings: [...warnings].sort(),
    requiredDocuments: [...requiredDocuments].sort(),
  };
}