// Corrected Decimal-safe mortgage financial primitives — CASA Mortgage
// Pre-Score v1.1 (AUDITED) section 9 + independent audit section 8. Pure
// functions only; NOT wired to any route or the existing scoring.service.ts.
// Existing live code keeps using its own (audited-as-flawed) formulas until
// a separate decision replaces it — see gap-audit doc.
//
// Deliberately fixes the two errors the audit found by name:
// 1. A single debt ratio must not mix regulatory KDN / bank affordability /
//    CASA safety buffer — callers pass in the exact ratio for the exact
//    metric they're computing; this module never picks one for you.
// 2. Max property price must respect down-payment ratio, LTV cap and max
//    loan simultaneously — not just `maxLoan + downPayment`.

import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
export type Decimal = InstanceType<typeof Prisma.Decimal>;

function toDecimal(value: Decimal | number | string): Decimal {
  return value instanceof D ? value : new D(value);
}

// available = max(0, ratio * income - load)
// income <= 0 is the caller's responsibility to reject before calling this
// (spec: "I≤0 → undefined, reason CALCULATION_INPUT_INVALID").
export function availablePayment(
  income: Decimal | number | string,
  load: Decimal | number | string,
  ratio: Decimal | number | string
): Decimal {
  const i = toDecimal(income);
  const o = toDecimal(load);
  const r = toDecimal(ratio);
  const available = r.mul(i).sub(o);
  return D.max(0, available);
}

// KDN after = (load + newPayment) / income
export function kdnAfter(
  load: Decimal | number | string,
  newPayment: Decimal | number | string,
  income: Decimal | number | string
): Decimal {
  const i = toDecimal(income);
  if (i.lte(0)) {
    throw new Error('CALCULATION_INPUT_INVALID: income must be positive');
  }
  return toDecimal(load).add(toDecimal(newPayment)).div(i);
}

// Annuity payment for a given principal: M = P·i·(1+i)^n / ((1+i)^n - 1)
// i=0 → M = P/n (spec section 9.2/9.3).
export function annuityPayment(
  principal: Decimal | number | string,
  periodicRate: Decimal | number | string,
  periods: number
): Decimal {
  if (periods <= 0) {
    throw new Error('CALCULATION_INPUT_INVALID: periods must be positive');
  }
  const p = toDecimal(principal);
  const i = toDecimal(periodicRate);
  if (i.eq(0)) {
    return p.div(periods);
  }
  const factor = i.add(1).pow(periods);
  return p.mul(i).mul(factor).div(factor.sub(1));
}

// Reverse annuity: max principal supportable by a given payment.
// P = M·((1+i)^n - 1) / (i·(1+i)^n); i=0 → P = M·n.
export function annuityPrincipal(
  payment: Decimal | number | string,
  periodicRate: Decimal | number | string,
  periods: number
): Decimal {
  if (periods <= 0) {
    throw new Error('CALCULATION_INPUT_INVALID: periods must be positive');
  }
  const m = toDecimal(payment);
  const i = toDecimal(periodicRate);
  if (i.eq(0)) {
    return m.mul(periods);
  }
  const factor = i.add(1).pow(periods);
  return m.mul(factor.sub(1)).div(i.mul(factor));
}

// Eligible collateral: V = min(purchase_price, appraisal_value) unless a
// sourced program rule states otherwise (spec section 9.2). Caller passes
// null when appraisal is missing — status handling (CONDITIONAL/UNKNOWN)
// is the caller's responsibility, this just refuses to guess.
export function eligibleCollateral(
  purchasePrice: Decimal | number | string,
  appraisalValue: Decimal | number | string | null
): Decimal {
  const price = toDecimal(purchasePrice);
  if (appraisalValue === null) {
    return price;
  }
  return D.min(price, toDecimal(appraisalValue));
}

// Required down payment: max(d*price, price - L*V, price - maxLoan, 0)
// (spec section 9.2 — the audit's GC-05 case).
export function requiredDownPayment(
  price: Decimal | number | string,
  minDownRatio: Decimal | number | string,
  maxLtv: Decimal | number | string,
  eligibleCollateralValue: Decimal | number | string,
  maxLoan: Decimal | number | string
): Decimal {
  const p = toDecimal(price);
  const d = toDecimal(minDownRatio);
  const l = toDecimal(maxLtv);
  const v = toDecimal(eligibleCollateralValue);
  const loan = toDecimal(maxLoan);

  const byRatio = d.mul(p);
  const byLtv = p.sub(l.mul(v));
  const byMaxLoan = p.sub(loan);

  return D.max(byRatio, byLtv, byMaxLoan, 0);
}

// Abstract max affordable price BEFORE a specific property is chosen:
// min(price_cap, D + max_loan, D/d, D/(1-L)) — this replaces the audited-
// as-wrong `maxLoan + downPayment` formula, which ignores the down-payment
// ratio and LTV cap entirely (AUD-027 / gap-audit finding).
export function abstractMaxPropertyPrice(
  downPaymentCash: Decimal | number | string,
  maxLoan: Decimal | number | string,
  minDownRatio: Decimal | number | string,
  maxLtv: Decimal | number | string,
  priceCap: Decimal | number | string | null
): Decimal {
  const dCash = toDecimal(downPaymentCash);
  const loan = toDecimal(maxLoan);
  const d = toDecimal(minDownRatio);
  const l = toDecimal(maxLtv);

  const candidates: Decimal[] = [dCash.add(loan)];
  if (d.gt(0)) candidates.push(dCash.div(d));
  if (l.lt(1)) candidates.push(dCash.div(new D(1).sub(l)));
  if (priceCap !== null) candidates.push(toDecimal(priceCap));

  return candidates.reduce((min, c) => D.min(min, c));
}
