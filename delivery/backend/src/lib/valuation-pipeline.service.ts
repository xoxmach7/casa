// Pure calculation/guard logic for the Valuation module (CASA Developer
// Handoff v2.0, 02_CASA_Valuation_Spec). Kept side-effect free so it's
// testable without a DB — the routes/service layer wires this to Prisma.

export interface PreliminaryRange {
  preliminaryLow: number;
  preliminaryHigh: number;
}

// preliminary_low = area × base_price_per_m2_low × strong_modifier_low
// preliminary_high = area × base_price_per_m2_high × strong_modifier_high
// Modifiers default to 1 (neutral) until real coefficients are configured
// via ConfigVersion — spec section 5: "До появления собственной статистики
// точные проценты не применяются автоматически."
export function computePreliminaryRange(
  area: number,
  basePricePerM2Low: number,
  basePricePerM2High: number,
  modifierLow = 1,
  modifierHigh = 1
): PreliminaryRange {
  return {
    preliminaryLow: Math.round(area * basePricePerM2Low * modifierLow),
    preliminaryHigh: Math.round(area * basePricePerM2High * modifierHigh),
  };
}

export type ComparableConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ComparablePoolAssessment {
  // false only for the 0-2 bucket — confirm is blocked without an explicit
  // manual override in that case (spec section 6).
  minimumMet: boolean;
  suggestedConfidence: ComparableConfidence;
}

export function assessComparablePool(includedCount: number): ComparablePoolAssessment {
  if (includedCount <= 2) {
    return { minimumMet: false, suggestedConfidence: 'LOW' };
  }
  if (includedCount <= 4) {
    return { minimumMet: true, suggestedConfidence: 'LOW' };
  }
  if (includedCount <= 10) {
    return { minimumMet: true, suggestedConfidence: 'MEDIUM' };
  }
  return { minimumMet: true, suggestedConfidence: 'HIGH' };
}

export interface ConfirmGuardResult {
  allowed: boolean;
  reason?: string;
}

// confirmValuation guard: blocked below the minimum comparable pool unless
// the caller explicitly acknowledges a manual override (reviewerReason is
// always required separately — this is an additional, deliberate flag).
export function canConfirmValuation(
  includedComparablesCount: number,
  manualOverride: boolean
): ConfirmGuardResult {
  const { minimumMet } = assessComparablePool(includedComparablesCount);
  if (minimumMet) {
    return { allowed: true };
  }
  if (manualOverride) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `insufficient_comparables: ${includedComparablesCount} included, minimum is 3 without manual override`,
  };
}

// Normalizes a comparable's source_ref before the DB-level uniqueness check
// (valuation_version_id + normalized_source_ref) — spec section 4.
export function normalizeSourceRef(sourceRef: string): string {
  return sourceRef.trim().toLowerCase();
}
