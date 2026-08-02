import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  availablePayment,
  kdnAfter,
  annuityPayment,
  annuityPrincipal,
  eligibleCollateral,
  requiredDownPayment,
  abstractMaxPropertyPrice,
} from '../lib/mortgage-financial.service';

const D = Prisma.Decimal;

describe('availablePayment', () => {
  // GC-01: I=800000; O=180000; r=.5 -> available=220000
  it('matches golden case GC-01', () => {
    const result = availablePayment(800_000, 180_000, 0.5);
    expect(result.toNumber()).toBe(220_000);
  });

  // GC-04: I=400000; O=220000; r=.5 -> available=0 (not negative)
  it('never goes negative — matches golden case GC-04', () => {
    const result = availablePayment(400_000, 220_000, 0.5);
    expect(result.toNumber()).toBe(0);
  });

  // GC-06: unique load 250k (not 300k after joint-facility dedup), ratio .5 on income 1m
  it('matches golden case GC-06 (post-dedup household aggregate)', () => {
    const income = 1_000_000;
    const uniqueLoad = 250_000;
    const result = availablePayment(income, uniqueLoad, 0.5);
    expect(result.toNumber()).toBe(250_000);
  });
});

describe('kdnAfter', () => {
  // GC-01: (180000+200000)/800000 = .475, buffer = .5-.475 = .025
  it('matches golden case GC-01', () => {
    const result = kdnAfter(180_000, 200_000, 800_000);
    expect(result.toNumber()).toBeCloseTo(0.475, 10);
    const buffer = new D(0.5).sub(result);
    expect(buffer.toNumber()).toBeCloseTo(0.025, 10);
  });

  it('throws CALCULATION_INPUT_INVALID for non-positive income instead of dividing', () => {
    expect(() => kdnAfter(100_000, 50_000, 0)).toThrow('CALCULATION_INPUT_INVALID');
    expect(() => kdnAfter(100_000, 50_000, -1)).toThrow('CALCULATION_INPUT_INVALID');
  });
});

describe('annuityPrincipal (reverse annuity — max loan from a payment)', () => {
  // GC-02: M=200000; nominal 18% annual -> monthly i=.015; n=180
  it('matches golden case GC-02', () => {
    const result = annuityPrincipal(200_000, 0.015, 180);
    // Expected: 12,419,112.462224308641... before contractual rounding
    expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(12_419_112.46, 1);
  });

  // GC-03: M=100000; i=0; n=120 -> P=12,000,000
  it('matches golden case GC-03 (zero-rate product)', () => {
    const result = annuityPrincipal(100_000, 0, 120);
    expect(result.toNumber()).toBe(12_000_000);
  });

  it('rejects a non-positive term instead of dividing by zero', () => {
    expect(() => annuityPrincipal(100_000, 0.01, 0)).toThrow('CALCULATION_INPUT_INVALID');
  });
});

describe('annuityPayment (forward annuity)', () => {
  it('is the inverse of annuityPrincipal for GC-02', () => {
    const principal = annuityPrincipal(200_000, 0.015, 180);
    const payment = annuityPayment(principal, 0.015, 180);
    expect(payment.toDecimalPlaces(2).toNumber()).toBeCloseTo(200_000, 1);
  });

  it('handles the zero-rate branch', () => {
    const result = annuityPayment(12_000_000, 0, 120);
    expect(result.toNumber()).toBe(100_000);
  });
});

describe('eligibleCollateral', () => {
  // GC-05: price=40m; appraisal=36m -> min = 36m
  it('matches golden case GC-05', () => {
    const result = eligibleCollateral(40_000_000, 36_000_000);
    expect(result.toNumber()).toBe(36_000_000);
  });

  it('does not invent a value when appraisal is missing', () => {
    const result = eligibleCollateral(40_000_000, null);
    expect(result.toNumber()).toBe(40_000_000);
  });
});

describe('requiredDownPayment', () => {
  // GC-05: price=40m; appraisal=36m; L=.8; D=8m
  // -> max loan by collateral = L*V = 28.8m; required down = 11.2m; shortfall = 3.2m
  it('matches golden case GC-05', () => {
    const v = eligibleCollateral(40_000_000, 36_000_000); // 36m
    const maxLoanByCollateral = new D(0.8).mul(v); // 28.8m
    const result = requiredDownPayment(40_000_000, 0, 0.8, v, maxLoanByCollateral);

    expect(maxLoanByCollateral.toNumber()).toBe(28_800_000);
    expect(result.toNumber()).toBe(11_200_000);

    const cash = new D(8_000_000);
    const shortfall = result.sub(cash);
    expect(shortfall.toNumber()).toBe(3_200_000);
  });
});

describe('abstractMaxPropertyPrice', () => {
  // This is the corrected replacement for the audited-as-wrong
  // `maxLoan + downPayment` formula — it must respect the down-payment
  // ratio and LTV cap, not just add the two numbers together.
  it('is capped by the down-payment ratio even when maxLoan+cash would suggest more', () => {
    // D=5m, maxLoan=50m (cash+loan=55m), but minDownRatio=.2 means D/d=25m cap
    const result = abstractMaxPropertyPrice(5_000_000, 50_000_000, 0.2, 0.8, null);
    expect(result.toNumber()).toBe(25_000_000);
  });

  it('is capped by the LTV ratio (D/(1-L)) when tighter than the ratio cap', () => {
    // D=5m, maxLoan=50m, minDownRatio=.1 (D/d=50m), maxLtv=.9 -> D/(1-L)=50m
    // both LTV and ratio caps equal here; tighten LTV to .95 -> D/(1-L)=100m (looser)
    // use a case where LTV cap is the binding one: L=.5 -> D/(1-L)=10m
    const result = abstractMaxPropertyPrice(5_000_000, 50_000_000, 0.1, 0.5, null);
    expect(result.toNumber()).toBe(10_000_000);
  });

  it('respects an explicit price cap when it is the tightest constraint', () => {
    const result = abstractMaxPropertyPrice(5_000_000, 50_000_000, 0.1, 0.8, 15_000_000);
    expect(result.toNumber()).toBe(15_000_000);
  });
});
