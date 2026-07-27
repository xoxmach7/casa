export const URGENT_SALE_MULTIPLIER = 0.9;
export const MARKET_SALE_MULTIPLIER = 0.93;

export interface Comparable {
  price: number;
  area: number;
}

export interface ValuationResult {
  marketValue: number;
  urgentPrice: number;
  marketPrice: number;
  comparablesCount: number;
}

export function computeValuation(
  comparables: Comparable[],
  targetArea: number
): ValuationResult | null {
  if (comparables.length === 0) {
    return null;
  }

  const avgPricePerSqm =
    comparables.reduce((sum, c) => sum + c.price / c.area, 0) / comparables.length;

  const marketValue = Math.round(avgPricePerSqm * targetArea);

  return {
    marketValue,
    urgentPrice: Math.round(marketValue * URGENT_SALE_MULTIPLIER),
    marketPrice: Math.round(marketValue * MARKET_SALE_MULTIPLIER),
    comparablesCount: comparables.length,
  };
}
