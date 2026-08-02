import { describe, it, expect } from 'vitest';
import {
  computePreliminaryRange,
  assessComparablePool,
  canConfirmValuation,
  normalizeSourceRef,
} from '../lib/valuation-pipeline.service';

describe('computePreliminaryRange', () => {
  it('multiplies area by base price per m2 with neutral modifiers by default', () => {
    const result = computePreliminaryRange(60, 500000, 550000);
    expect(result).toEqual({ preliminaryLow: 30_000_000, preliminaryHigh: 33_000_000 });
  });

  it('applies strong modifiers when provided', () => {
    const result = computePreliminaryRange(60, 500000, 550000, 0.95, 1.05);
    expect(result).toEqual({ preliminaryLow: 28_500_000, preliminaryHigh: 34_650_000 });
  });
});

describe('assessComparablePool', () => {
  it('blocks confirm without override at 0-2 comparables', () => {
    expect(assessComparablePool(0)).toEqual({ minimumMet: false, suggestedConfidence: 'LOW' });
    expect(assessComparablePool(2)).toEqual({ minimumMet: false, suggestedConfidence: 'LOW' });
  });

  it('allows confirm with low confidence at 3-4 comparables', () => {
    expect(assessComparablePool(3)).toEqual({ minimumMet: true, suggestedConfidence: 'LOW' });
    expect(assessComparablePool(4)).toEqual({ minimumMet: true, suggestedConfidence: 'LOW' });
  });

  it('allows confirm with medium confidence at 5-10 comparables', () => {
    expect(assessComparablePool(5)).toEqual({ minimumMet: true, suggestedConfidence: 'MEDIUM' });
    expect(assessComparablePool(10)).toEqual({ minimumMet: true, suggestedConfidence: 'MEDIUM' });
  });

  it('allows confirm with high confidence above 10 comparables', () => {
    expect(assessComparablePool(11)).toEqual({ minimumMet: true, suggestedConfidence: 'HIGH' });
  });
});

describe('canConfirmValuation', () => {
  it('blocks confirm below minimum without manual override', () => {
    expect(canConfirmValuation(1, false)).toEqual({
      allowed: false,
      reason: 'insufficient_comparables: 1 included, minimum is 3 without manual override',
    });
  });

  it('allows confirm below minimum when manual override is set', () => {
    expect(canConfirmValuation(1, true)).toEqual({ allowed: true });
  });

  it('allows confirm at or above minimum regardless of override flag', () => {
    expect(canConfirmValuation(3, false)).toEqual({ allowed: true });
  });
});

describe('normalizeSourceRef', () => {
  it('trims and lowercases the source ref', () => {
    expect(normalizeSourceRef('  Krisha.kz/A123  ')).toBe('krisha.kz/a123');
  });
});
