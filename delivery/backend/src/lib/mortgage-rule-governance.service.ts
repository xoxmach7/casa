import { Prisma } from '@prisma/client';

export type GovernedRuleStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'RETIRED'
  | 'REJECTED';

export interface GovernedRuleVersion {
  id: string;
  authorId: string | null;
  approverId: string | null;
  status: GovernedRuleStatus;
  sourceUrl: string | null;
  sourceHash: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  verifiedAt: Date | null;
  staleDays: number;
  financialTerms: {
    annualNominalRate: string;
    termMonths: number;
    debtRatio: string;
    minDownPaymentRatio: string;
    maxLtv: string;
    maxLoan: string;
  };
}

export interface ActiveRuleInterval {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

const REASON_ORDER = [
  'RULE_NOT_APPROVED',
  'MAKER_CHECKER_REQUIRED',
  'RULE_SOURCE_REQUIRED',
  'RULE_FINANCIAL_TERMS_INVALID',
  'RULE_EFFECTIVE_INTERVAL_INVALID',
  'RULE_INTERVAL_OVERLAP',
  'RULE_VERIFICATION_STALE',
] as const;

export function isMortgageRuleFresh(
  rule: Pick<GovernedRuleVersion, 'verifiedAt' | 'staleDays'>,
  asOf: Date,
): boolean {
  if (!rule.verifiedAt || !Number.isInteger(rule.staleDays) || rule.staleDays <= 0) return false;
  const ageMs = asOf.getTime() - rule.verifiedAt.getTime();
  return ageMs >= 0 && ageMs <= rule.staleDays * 24 * 60 * 60 * 1000;
}

function intervalsOverlap(
  candidateFrom: Date,
  candidateTo: Date | null,
  existingFrom: Date,
  existingTo: Date | null,
): boolean {
  const candidateEnd = candidateTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const existingEnd = existingTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return candidateFrom.getTime() <= existingEnd && existingFrom.getTime() <= candidateEnd;
}

function validFinancialTerms(terms: GovernedRuleVersion['financialTerms']): boolean {
  try {
    const annualRate = new Prisma.Decimal(terms.annualNominalRate);
    const debtRatio = new Prisma.Decimal(terms.debtRatio);
    const minDownPaymentRatio = new Prisma.Decimal(terms.minDownPaymentRatio);
    const maxLtv = new Prisma.Decimal(terms.maxLtv);
    const maxLoan = new Prisma.Decimal(terms.maxLoan);
    return annualRate.isFinite() && !annualRate.isNegative()
      && Number.isInteger(terms.termMonths) && terms.termMonths > 0
      && debtRatio.isFinite() && debtRatio.gt(0) && debtRatio.lte(1)
      && minDownPaymentRatio.isFinite() && !minDownPaymentRatio.isNegative() && minDownPaymentRatio.lte(1)
      && maxLtv.isFinite() && maxLtv.gt(0) && maxLtv.lte(1)
      && maxLoan.isFinite() && maxLoan.gt(0);
  } catch {
    return false;
  }
}
export function evaluateMortgageRuleActivation(
  candidate: GovernedRuleVersion,
  activeIntervals: ActiveRuleInterval[],
  asOf: Date,
): { allowed: boolean; reasonCodes: string[] } {
  const reasons = new Set<string>();

  if (candidate.status !== 'APPROVED') reasons.add('RULE_NOT_APPROVED');
  if (
    !candidate.authorId
    || !candidate.approverId
    || candidate.authorId === candidate.approverId
  ) {
    reasons.add('MAKER_CHECKER_REQUIRED');
  }
  if (!validFinancialTerms(candidate.financialTerms)) reasons.add('RULE_FINANCIAL_TERMS_INVALID');
  if (
    !candidate.sourceUrl
    || !candidate.sourceHash
    || !/^[0-9a-f]{64}$/i.test(candidate.sourceHash)
  ) {
    reasons.add('RULE_SOURCE_REQUIRED');
  }
  if (
    !candidate.effectiveFrom
    || (candidate.effectiveTo !== null && candidate.effectiveTo <= candidate.effectiveFrom)
  ) {
    reasons.add('RULE_EFFECTIVE_INTERVAL_INVALID');
  } else if (
    activeIntervals.some(
      (existing) => existing.id !== candidate.id
        && intervalsOverlap(
          candidate.effectiveFrom!,
          candidate.effectiveTo,
          existing.effectiveFrom,
          existing.effectiveTo,
        ),
    )
  ) {
    reasons.add('RULE_INTERVAL_OVERLAP');
  }
  if (!isMortgageRuleFresh(candidate, asOf)) reasons.add('RULE_VERIFICATION_STALE');

  const reasonCodes = [...reasons].sort(
    (left, right) => REASON_ORDER.indexOf(left as (typeof REASON_ORDER)[number])
      - REASON_ORDER.indexOf(right as (typeof REASON_ORDER)[number]),
  );
  return { allowed: reasonCodes.length === 0, reasonCodes };
}