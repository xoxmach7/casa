import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import {
  annuityPayment,
  annuityPrincipal,
  availablePayment,
  eligibleCollateral,
  kdnAfter,
  requiredDownPayment,
} from './mortgage-financial.service';

const D = Prisma.Decimal;
type Decimal = InstanceType<typeof Prisma.Decimal>;

export type ConsentStatus = 'ACTIVE' | 'MISSING' | 'EXPIRED' | 'REVOKED';
export type ProgramAxisStatus = 'PASS' | 'CONDITIONAL' | 'FAIL' | 'UNKNOWN';
export type CreditDiscipline = 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'INSUFFICIENT_DATA';
export type IncomeStability = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
export type OverallReadiness = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface SnapshotIncomeStream {
  fingerprint: string;
  amount: string;
  verified: boolean;
  eligible: boolean;
}

export interface SnapshotFacility {
  fingerprint: string;
  monthlyPayment: string;
  applicable: boolean;
}

export interface SnapshotProperty {
  purchasePrice: string;
  appraisalValue: string | null;
  downPaymentCash: string;
  inventoryStatus: 'AVAILABLE' | 'STALE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';
}

export interface VerifiedMortgageSnapshot {
  id: string;
  inputHash: string;
  asOf: string;
  consentStatus: ConsentStatus;
  criticalDataResolved: boolean;
  incomeStreams: SnapshotIncomeStream[];
  facilities: SnapshotFacility[];
  property?: SnapshotProperty;
  creditDiscipline: CreditDiscipline;
  incomeStability: IncomeStability;
  dataConfidence: DataConfidence;
}

export interface MortgageProgramRuleCard {
  programId: string;
  ruleVersionId: string;
  status: 'ACTIVE' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'RETIRED' | 'REJECTED';
  validFrom: string;
  validTo: string | null;
  sourceStatus: 'CONFIRMED' | 'UNKNOWN';
  annualNominalRate: string;
  termMonths: number;
  debtRatio: string;
  minDownPaymentRatio: string;
  maxLtv: string;
  maxLoan: string;
  hardFilterFailures: string[];
}

export interface RequiredAction {
  field: string;
  target: string;
  delta: string;
  evidence: string;
}

export interface ProgramAssessment {
  programId: string;
  ruleVersionId: string;
  eligibility: ProgramAxisStatus;
  affordability: ProgramAxisStatus;
  reasonCodes: string[];
  requiredActions: RequiredAction[];
  availablePayment?: string;
  proposedPayment?: string;
  kdnAfter?: string;
  requiredDownPayment?: string;
  downPaymentShortfall?: string;
}

export interface MortgagePreScoreInput {
  snapshot: VerifiedMortgageSnapshot;
  programs: MortgageProgramRuleCard[];
}

export interface MortgagePreScoreResult {
  snapshotId: string;
  inputHash: string;
  asOf: string;
  overallReadiness: OverallReadiness;
  assessments: ProgramAssessment[];
  matchedProgramIds: string[];
  unresolvedProgramIds: string[];
  excludedProgramIds: string[];
  reasonCodes: string[];
  trace: {
    eligibleIncome: string;
    existingLoad: string;
    duplicateIncomeFingerprints: string[];
    duplicateFacilityFingerprints: string[];
    conflictingIncomeFingerprints: string[];
    conflictingFacilityFingerprints: string[];
  };
  outputHash: string;
  disclaimer: string;
}

export interface ReadinessInput {
  hasSuitableProgram: boolean;
  hasConditionalProgram: boolean;
  affordability: ProgramAxisStatus;
  creditDiscipline: CreditDiscipline;
  incomeStability: IncomeStability;
  dataConfidence: DataConfidence;
  criticalBlocker: boolean;
}

const REASON_ORDER = [
  'CONSENT_MISSING',
  'CONSENT_REVOKED',
  'CONSENT_EXPIRED',
  'CRITICAL_DATA_MISSING',
  'CALCULATION_INPUT_INVALID',
  'PROGRAM_RULE_STALE',
  'PROGRAM_RULE_UNKNOWN',
  'PARTNER_CONFIRMATION_REQUIRED',
  'PROPERTY_UNAVAILABLE',
  'PROPERTY_STALE',
  'AGE_AT_MATURITY_EXCEEDED',
  'INCOME_INSUFFICIENT',
  'DOWN_PAYMENT_SHORTFALL',
  'LTV_EXCEEDED',
  'DUPLICATE_INCOME_SUPPRESSED',
] as const;

const reasonRank = new Map<string, number>(REASON_ORDER.map((code, index) => [code, index]));

function sortedReasons(reasons: Iterable<string>): string[] {
  return [...new Set(reasons)].sort((left, right) => {
    const rank = (reasonRank.get(left) ?? Number.MAX_SAFE_INTEGER) - (reasonRank.get(right) ?? Number.MAX_SAFE_INTEGER);
    return rank === 0 ? left.localeCompare(right) : rank;
  });
}

function decimal(value: string | number): Decimal {
  return new D(value);
}

function safeDecimal(value: string | number): Decimal | null {
  try {
    const parsed = decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function amount(value: Decimal): string {
  return value.toFixed();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashOutput(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function deduplicateAmounts<T extends { fingerprint: string }>(
  values: T[],
  include: (value: T) => boolean,
  getAmount: (value: T) => string,
): { total: Decimal; duplicates: string[]; conflicts: string[]; invalid: boolean } {
  const seen = new Map<string, Decimal>();
  const duplicates = new Set<string>();
  const conflicts = new Set<string>();
  let invalid = false;
  let total = new D(0);

  for (const value of values) {
    if (!include(value)) continue;
    const current = safeDecimal(getAmount(value));
    if (!current) {
      invalid = true;
      continue;
    }
    if (current.isNegative()) invalid = true;
    const previous = seen.get(value.fingerprint);
    if (previous) {
      duplicates.add(value.fingerprint);
      if (!previous.eq(current)) conflicts.add(value.fingerprint);
      continue;
    }
    seen.set(value.fingerprint, current);
    total = total.add(current);
  }

  return {
    total,
    duplicates: [...duplicates].sort(),
    conflicts: [...conflicts].sort(),
    invalid,
  };
}

function consentReason(status: ConsentStatus): string | null {
  if (status === 'MISSING') return 'CONSENT_MISSING';
  if (status === 'REVOKED') return 'CONSENT_REVOKED';
  if (status === 'EXPIRED') return 'CONSENT_EXPIRED';
  return null;
}

function unknownAssessment(rule: MortgageProgramRuleCard, reasonCode: string): ProgramAssessment {
  return {
    programId: rule.programId,
    ruleVersionId: rule.ruleVersionId,
    eligibility: 'UNKNOWN',
    affordability: 'UNKNOWN',
    reasonCodes: [reasonCode],
    requiredActions: [],
  };
}

function isRuleEffective(rule: MortgageProgramRuleCard, asOf: Date): boolean {
  const from = new Date(rule.validFrom);
  const to = rule.validTo ? new Date(rule.validTo) : null;
  return from <= asOf && (!to || asOf <= to);
}

function minimum(left: Decimal, right: Decimal): Decimal {
  return D.min(left, right);
}

export function deriveOverallReadiness(input: ReadinessInput): OverallReadiness {
  if (
    input.criticalBlocker ||
    input.creditDiscipline === 'INSUFFICIENT_DATA' ||
    input.incomeStability === 'INSUFFICIENT_DATA' ||
    input.dataConfidence === 'INSUFFICIENT_DATA'
  ) {
    return 'INSUFFICIENT_DATA';
  }

  if (
    (!input.hasSuitableProgram && !input.hasConditionalProgram) ||
    input.affordability === 'FAIL' ||
    input.creditDiscipline === 'HIGH_RISK' ||
    input.incomeStability === 'LOW' ||
    input.dataConfidence === 'LOW'
  ) {
    return 'LOW';
  }

  if (
    input.hasSuitableProgram &&
    input.affordability === 'PASS' &&
    input.creditDiscipline === 'LOW_RISK' &&
    input.incomeStability === 'HIGH' &&
    input.dataConfidence === 'HIGH'
  ) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

function assessProgram(
  snapshot: VerifiedMortgageSnapshot,
  rule: MortgageProgramRuleCard,
  eligibleIncome: Decimal,
  existingLoad: Decimal,
): ProgramAssessment {
  const asOf = new Date(snapshot.asOf);

  if (rule.status !== 'ACTIVE' || rule.sourceStatus !== 'CONFIRMED') {
    return unknownAssessment(rule, 'PROGRAM_RULE_UNKNOWN');
  }
  if (!isRuleEffective(rule, asOf)) {
    return unknownAssessment(rule, 'PROGRAM_RULE_STALE');
  }
  if (rule.hardFilterFailures.length > 0) {
    return {
      programId: rule.programId,
      ruleVersionId: rule.ruleVersionId,
      eligibility: 'FAIL',
      affordability: 'UNKNOWN',
      reasonCodes: sortedReasons(rule.hardFilterFailures),
      requiredActions: [],
    };
  }

  const annualNominalRate = safeDecimal(rule.annualNominalRate);
  const debtRatio = safeDecimal(rule.debtRatio);
  const minDownPaymentRatio = safeDecimal(rule.minDownPaymentRatio);
  const maxLtv = safeDecimal(rule.maxLtv);
  const maxLoan = safeDecimal(rule.maxLoan);
  if (
    eligibleIncome.lte(0)
    || !Number.isInteger(rule.termMonths)
    || rule.termMonths <= 0
    || !annualNominalRate || annualNominalRate.isNegative()
    || !debtRatio || debtRatio.lte(0) || debtRatio.gt(1)
    || !minDownPaymentRatio || minDownPaymentRatio.isNegative() || minDownPaymentRatio.gt(1)
    || !maxLtv || maxLtv.lte(0) || maxLtv.gt(1)
    || !maxLoan || maxLoan.lte(0)
  ) {
    return unknownAssessment(rule, 'CALCULATION_INPUT_INVALID');
  }

  const available = availablePayment(eligibleIncome, existingLoad, debtRatio);
  const periodicRate = annualNominalRate.div(12);
  const affordablePrincipal = annuityPrincipal(available, periodicRate, rule.termMonths);
  const effectiveMaxLoan = minimum(affordablePrincipal, maxLoan);
  const reasons: string[] = [];
  const requiredActions: RequiredAction[] = [];

  if (!snapshot.property) {
    const affordability: ProgramAxisStatus = available.gt(0) ? 'PASS' : 'FAIL';
    if (affordability === 'FAIL') reasons.push('INCOME_INSUFFICIENT');
    return {
      programId: rule.programId,
      ruleVersionId: rule.ruleVersionId,
      eligibility: 'PASS',
      affordability,
      reasonCodes: sortedReasons(reasons),
      requiredActions,
      availablePayment: amount(available),
    };
  }

  const property = snapshot.property;
  if (['RESERVED', 'SOLD', 'UNAVAILABLE'].includes(property.inventoryStatus)) {
    return {
      programId: rule.programId,
      ruleVersionId: rule.ruleVersionId,
      eligibility: 'FAIL',
      affordability: 'UNKNOWN',
      reasonCodes: ['PROPERTY_UNAVAILABLE'],
      requiredActions,
      availablePayment: amount(available),
    };
  }
  if (property.inventoryStatus === 'STALE') {
    return {
      programId: rule.programId,
      ruleVersionId: rule.ruleVersionId,
      eligibility: 'UNKNOWN',
      affordability: 'UNKNOWN',
      reasonCodes: ['PROPERTY_STALE'],
      requiredActions,
      availablePayment: amount(available),
    };
  }

  if (property.appraisalValue === null) {
    return {
      programId: rule.programId,
      ruleVersionId: rule.ruleVersionId,
      eligibility: 'PASS',
      affordability: 'UNKNOWN',
      reasonCodes: ['CRITICAL_DATA_MISSING'],
      requiredActions,
      availablePayment: amount(available),
    };
  }

  const price = safeDecimal(property.purchasePrice);
  const cash = safeDecimal(property.downPaymentCash);
  const appraisal = safeDecimal(property.appraisalValue);
  if (!price || price.lte(0) || !cash || cash.isNegative() || cash.gt(price) || !appraisal || appraisal.lte(0)) {
    return unknownAssessment(rule, 'CALCULATION_INPUT_INVALID');
  }
  const collateral = D.min(price, appraisal);
  const requiredDown = requiredDownPayment(
    price,
    minDownPaymentRatio,
    maxLtv,
    collateral,
    effectiveMaxLoan,
  );
  const shortfall = D.max(0, requiredDown.sub(cash));
  const assessedCash = D.max(cash, requiredDown);
  const principal = D.max(0, price.sub(assessedCash));
  const payment = annuityPayment(principal, periodicRate, rule.termMonths);
  const resultingKdn = kdnAfter(existingLoad, payment, eligibleIncome);

  let affordability: ProgramAxisStatus = 'PASS';
  if (shortfall.gt(0)) {
    affordability = 'CONDITIONAL';
    reasons.push('DOWN_PAYMENT_SHORTFALL');
    requiredActions.push({
      field: 'property.downPaymentCash',
      target: amount(requiredDown),
      delta: amount(shortfall),
      evidence: 'VERIFIED_FUNDS',
    });
  } else if (payment.gt(available)) {
    affordability = 'FAIL';
    reasons.push('INCOME_INSUFFICIENT');
  }

  return {
    programId: rule.programId,
    ruleVersionId: rule.ruleVersionId,
    eligibility: 'PASS',
    affordability,
    reasonCodes: sortedReasons(reasons),
    requiredActions,
    availablePayment: amount(available),
    proposedPayment: amount(payment),
    kdnAfter: resultingKdn.toFixed(12),
    requiredDownPayment: amount(requiredDown),
    downPaymentShortfall: amount(shortfall),
  };
}

export function runMortgagePreScore(input: MortgagePreScoreInput): MortgagePreScoreResult {
  const income = deduplicateAmounts(
    input.snapshot.incomeStreams,
    (stream) => stream.verified && stream.eligible,
    (stream) => stream.amount,
  );
  const load = deduplicateAmounts(
    input.snapshot.facilities,
    (facility) => facility.applicable,
    (facility) => facility.monthlyPayment,
  );

  const baseReasons: string[] = [];
  const consentBlocker = consentReason(input.snapshot.consentStatus);
  if (consentBlocker) baseReasons.push(consentBlocker);
  if (!input.snapshot.criticalDataResolved) baseReasons.push('CRITICAL_DATA_MISSING');
  if (income.duplicates.length > 0) baseReasons.push('DUPLICATE_INCOME_SUPPRESSED');
  if (income.conflicts.length > 0 || load.conflicts.length > 0) baseReasons.push('CRITICAL_DATA_MISSING');
  if (income.invalid || load.invalid || income.total.lte(0)) baseReasons.push('CALCULATION_INPUT_INVALID');

  const blocked = Boolean(consentBlocker)
    || !input.snapshot.criticalDataResolved
    || income.conflicts.length > 0
    || load.conflicts.length > 0
    || income.invalid
    || load.invalid
    || income.total.lte(0);
  const sortedPrograms = [...input.programs].sort((left, right) => {
    const programOrder = left.programId.localeCompare(right.programId);
    return programOrder === 0 ? left.ruleVersionId.localeCompare(right.ruleVersionId) : programOrder;
  });
  const assessments = blocked
    ? []
    : sortedPrograms.map((program) => assessProgram(input.snapshot, program, income.total, load.total));

  const matchedProgramIds = assessments
    .filter((item) => item.eligibility === 'PASS' && (item.affordability === 'PASS' || item.affordability === 'CONDITIONAL'))
    .sort((left, right) => {
      if (left.affordability !== right.affordability) return left.affordability === 'PASS' ? -1 : 1;
      return left.programId.localeCompare(right.programId);
    })
    .map((item) => item.programId);
  const unresolvedProgramIds = assessments
    .filter((item) => item.eligibility === 'UNKNOWN' || item.affordability === 'UNKNOWN')
    .map((item) => item.programId)
    .sort();
  const excludedProgramIds = assessments
    .filter((item) => item.eligibility === 'FAIL' || item.affordability === 'FAIL')
    .map((item) => item.programId)
    .sort();

  const allReasons = sortedReasons([
    ...baseReasons,
    ...assessments.flatMap((assessment) => assessment.reasonCodes),
  ]);
  const hasPass = assessments.some((item) => item.eligibility === 'PASS' && item.affordability === 'PASS');
  const hasConditional = assessments.some(
    (item) => item.eligibility === 'PASS' && item.affordability === 'CONDITIONAL',
  );
  const bestAffordability: ProgramAxisStatus = hasPass
    ? 'PASS'
    : hasConditional
      ? 'CONDITIONAL'
      : assessments.some((item) => item.affordability === 'FAIL')
        ? 'FAIL'
        : 'UNKNOWN';

  const overallReadiness = deriveOverallReadiness({
    hasSuitableProgram: hasPass,
    hasConditionalProgram: hasConditional,
    affordability: bestAffordability,
    creditDiscipline: input.snapshot.creditDiscipline,
    incomeStability: input.snapshot.incomeStability,
    dataConfidence: input.snapshot.dataConfidence,
    criticalBlocker: blocked || assessments.length === 0 || unresolvedProgramIds.length === assessments.length,
  });

  const resultWithoutHash = {
    snapshotId: input.snapshot.id,
    inputHash: input.snapshot.inputHash,
    asOf: input.snapshot.asOf,
    overallReadiness,
    assessments,
    matchedProgramIds,
    unresolvedProgramIds,
    excludedProgramIds,
    reasonCodes: allReasons,
    trace: {
      eligibleIncome: amount(income.total),
      existingLoad: amount(load.total),
      duplicateIncomeFingerprints: income.duplicates,
      duplicateFacilityFingerprints: load.duplicates,
      conflictingIncomeFingerprints: income.conflicts,
      conflictingFacilityFingerprints: load.conflicts,
    },
    disclaimer: 'Предварительная оценка CASA Pro. Окончательное решение принимает банк.',
  };

  return {
    ...resultWithoutHash,
    outputHash: hashOutput({
      snapshot: canonicalize(input.snapshot),
      programs: canonicalize(sortedPrograms),
      result: canonicalize(resultWithoutHash),
    }),
  };
}