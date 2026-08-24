import { describe, expect, it } from 'vitest';
import {
  evaluateMortgageRuleActivation,
  isMortgageRuleFresh,
  type GovernedRuleVersion,
} from '../lib/mortgage-rule-governance.service';

const rule = (overrides: Partial<GovernedRuleVersion> = {}): GovernedRuleVersion => ({
  id: 'rule_1',
  authorId: 'author_1',
  approverId: 'approver_1',
  status: 'APPROVED',
  sourceUrl: 'https://bank.example/program',
  sourceHash: 'a'.repeat(64),
  effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
  effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
  verifiedAt: new Date('2026-08-20T00:00:00.000Z'),
  staleDays: 14,
  financialTerms: {
    annualNominalRate: '0.18', termMonths: 180, debtRatio: '0.5',
    minDownPaymentRatio: '0.2', maxLtv: '0.8', maxLoan: '50000000',
  },  ...overrides,
});

describe('mortgage rule governance', () => {
  it('forbids maker self-approval', () => {
    const result = evaluateMortgageRuleActivation(
      rule({ approverId: 'author_1' }),
      [],
      new Date('2026-08-24T00:00:00.000Z'),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('MAKER_CHECKER_REQUIRED');
  });

  it('requires an approved status and verified source integrity', () => {
    const draft = evaluateMortgageRuleActivation(rule({ status: 'DRAFT' }), [], new Date());
    const sourceMissing = evaluateMortgageRuleActivation(
      rule({ sourceHash: null }),
      [],
      new Date('2026-08-24T00:00:00.000Z'),
    );

    expect(draft.reasonCodes).toContain('RULE_NOT_APPROVED');
    expect(sourceMissing.reasonCodes).toContain('RULE_SOURCE_REQUIRED');
  });

  it('rejects overlapping active intervals for the same governed scope', () => {
    const result = evaluateMortgageRuleActivation(
      rule(),
      [{
        id: 'rule_existing',
        effectiveFrom: new Date('2026-08-15T00:00:00.000Z'),
        effectiveTo: new Date('2026-10-01T00:00:00.000Z'),
      }],
      new Date('2026-08-24T00:00:00.000Z'),
    );

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('RULE_INTERVAL_OVERLAP');
  });

  it('blocks a green result when verification is stale', () => {
    expect(isMortgageRuleFresh(rule(), new Date('2026-09-10T00:00:00.000Z'))).toBe(false);
    const result = evaluateMortgageRuleActivation(
      rule(),
      [],
      new Date('2026-09-10T00:00:00.000Z'),
    );
    expect(result.reasonCodes).toContain('RULE_VERIFICATION_STALE');
  });

  it('rejects impossible financial terms before rule activation', () => {
    const candidate = {
      ...rule(),
      financialTerms: {
        annualNominalRate: '0.18', termMonths: 180, debtRatio: '1.2',
        minDownPaymentRatio: '0.2', maxLtv: '0.8', maxLoan: '50000000',
      },
    } as GovernedRuleVersion;
    const result = evaluateMortgageRuleActivation(candidate, [], new Date('2026-08-24T00:00:00.000Z'));
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('RULE_FINANCIAL_TERMS_INVALID');
  });
  it('allows a maker-checked, sourced, fresh and non-overlapping version', () => {
    const result = evaluateMortgageRuleActivation(
      rule(),
      [],
      new Date('2026-08-24T00:00:00.000Z'),
    );
    expect(result).toEqual({ allowed: true, reasonCodes: [] });
  });
});