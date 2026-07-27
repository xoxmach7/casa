import { describe, it, expect } from 'vitest';
import { computeValuation, URGENT_SALE_MULTIPLIER, MARKET_SALE_MULTIPLIER } from '../lib/valuation.service';

describe('computeValuation', () => {
  it('returns null when there are no comparables', () => {
    expect(computeValuation([], 60)).toBeNull();
  });

  it('computes price per m2 as the average across comparables', () => {
    const comparables = [
      { price: 30_000_000, area: 60 }, // 500,000 / m2
      { price: 42_000_000, area: 60 }, // 700,000 / m2
    ];
    // average price/m2 = 600,000
    const result = computeValuation(comparables, 60);
    expect(result).not.toBeNull();
    expect(result!.comparablesCount).toBe(2);
    expect(result!.marketValue).toBe(36_000_000); // 600,000 * 60
  });

  it('applies the urgent (0.90) and market (0.93) multipliers', () => {
    const comparables = [{ price: 30_000_000, area: 60 }]; // 500,000 / m2
    const result = computeValuation(comparables, 60)!;
    expect(result.marketValue).toBe(30_000_000);
    expect(result.urgentPrice).toBe(Math.round(30_000_000 * URGENT_SALE_MULTIPLIER));
    expect(result.marketPrice).toBe(Math.round(30_000_000 * MARKET_SALE_MULTIPLIER));
  });

  it('scales price per m2 by the target area, not the comparable area', () => {
    const comparables = [{ price: 30_000_000, area: 60 }]; // 500,000 / m2
    const result = computeValuation(comparables, 45)!;
    expect(result.marketValue).toBe(500_000 * 45);
  });
});
