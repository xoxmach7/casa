import { RESIDENTIAL_COMPLEXES } from "./addresses";
import type { ValuationParams, ValuationResult } from "./types";

export const INSTANT_SALE_MULTIPLIER = 0.9;
export const MARKET_SALE_MULTIPLIER = 0.93;

export function calculateValuation(
  residentialComplexName: string,
  params: ValuationParams
): ValuationResult {
  const complex = RESIDENTIAL_COMPLEXES.find(
    (candidate) => candidate.name === residentialComplexName
  );
  const pricePerM2 = complex?.pricePerM2ByRooms[params.rooms];

  if (!pricePerM2) {
    return { status: "insufficient_data" };
  }

  const baseValue = pricePerM2 * params.areaM2;

  return {
    status: "ready",
    basePricePerM2: pricePerM2,
    instantPrice: Math.round(baseValue * INSTANT_SALE_MULTIPLIER),
    marketPrice: Math.round(baseValue * MARKET_SALE_MULTIPLIER),
  };
}
