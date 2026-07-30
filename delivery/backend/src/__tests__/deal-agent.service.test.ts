import { describe, it, expect } from 'vitest';
import { evaluateDeal, nextStage, daysBetween, DealForEvaluation } from '../lib/deal-agent.service';

const NOW = new Date('2026-07-30T00:00:00.000Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function baseDeal(overrides: Partial<DealForEvaluation> = {}): DealForEvaluation {
  return {
    id: 'deal_1',
    stage: 'CONSULTATION',
    stageChangedAt: daysAgo(1),
    notes: 'клиент заинтересован',
    clientId: 'client_1',
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('computes whole days between two dates', () => {
    expect(daysBetween(daysAgo(5), NOW)).toBe(5);
  });
});

describe('nextStage', () => {
  it('returns the next stage in funnel order', () => {
    expect(nextStage('CONSULTATION')).toBe('CONTRACT');
    expect(nextStage('CONTRACT')).toBe('PROMOTION');
    expect(nextStage('PROMOTION')).toBe('SHOWINGS');
  });

  it('returns null for the last stage', () => {
    expect(nextStage('SHOWINGS')).toBeNull();
  });
});

describe('evaluateDeal', () => {
  it('returns no findings for a fresh, well-filled deal', () => {
    const deal = baseDeal({ stageChangedAt: daysAgo(1) });
    expect(evaluateDeal(deal, NOW)).toEqual([]);
  });

  it('flags a stalled deal past the CONSULTATION threshold (5 days)', () => {
    const deal = baseDeal({ stage: 'CONSULTATION', stageChangedAt: daysAgo(6) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'STALLED', daysInStage: 6 })
    );
  });

  it('does not flag a deal within its stage threshold', () => {
    const deal = baseDeal({ stage: 'CONTRACT', stageChangedAt: daysAgo(9) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings.some((f) => f.kind === 'STALLED')).toBe(false);
  });

  it('suggests the next stage alongside a stall alert', () => {
    const deal = baseDeal({ stage: 'CONTRACT', stageChangedAt: daysAgo(11) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'STAGE_SUGGESTED', suggestedStage: 'PROMOTION' })
    );
  });

  it('does not suggest a next stage from the last stage (SHOWINGS)', () => {
    const deal = baseDeal({ stage: 'SHOWINGS', stageChangedAt: daysAgo(8) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings.some((f) => f.kind === 'STAGE_SUGGESTED')).toBe(false);
    expect(findings.some((f) => f.kind === 'STALLED')).toBe(true);
  });

  it('flags missing info when both client and notes are absent', () => {
    const deal = baseDeal({ clientId: null, notes: null, stageChangedAt: daysAgo(1) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'MISSING_INFO' }));
  });

  it('does not flag missing info when only one of client/notes is present', () => {
    const deal = baseDeal({ clientId: null, notes: 'звонили клиенту', stageChangedAt: daysAgo(1) });
    const findings = evaluateDeal(deal, NOW);
    expect(findings.some((f) => f.kind === 'MISSING_INFO')).toBe(false);
  });
});
