import { describe, it, expect } from 'vitest';
import {
  requiredFinancing,
  annuityPaymentByParameters,
} from '../lib/mortgage-workspace/m06-calc';

/**
 * RG10 runtime-evidence fixtures для M06 Calculation Engine v1.4 (FROZEN).
 *
 * Прогон этих fixtures — фактическое доказательство поведения CALC-F-001 и
 * CALC-F-002 (positive / negative / boundary / UNKNOWN / invalid). Сам прогон
 * НЕ переводит RG10/RG11/RG12 в PASS автоматически (DEC-RG10-001) — это часть
 * доказательной базы, которую фиксирует владелец при закрытии gate.
 */

describe('CALC-F-001 casa.required_financing v1.0.0 — F = max(P − A, 0)', () => {
  it('positive: P=30 000 000, A=5 000 000 → F=25 000 000', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 5_000_000 });
    expect(r.blocker).toBeNull();
    expect(r.value).toBe('25000000.00');
    expect(r.displayKzt).toBe(25_000_000);
    expect(r.currency).toBe('KZT');
  });

  it('boundary: A > P → F=0 (не отрицательное)', () => {
    const r = requiredFinancing({ targetPrice: 10_000_000, availableNowDownPayment: 12_000_000 });
    expect(r.blocker).toBeNull();
    expect(r.value).toBe('0.00');
    expect(r.displayKzt).toBe(0);
  });

  it('boundary: A = P → F=0', () => {
    const r = requiredFinancing({ targetPrice: 18_000_000, availableNowDownPayment: 18_000_000 });
    expect(r.value).toBe('0.00');
  });

  it('rounding: персист Decimal(20,2) ROUND_HALF_UP один раз (100.005 → 100.01)', () => {
    const r = requiredFinancing({ targetPrice: '100.005', availableNowDownPayment: 0 });
    expect(r.value).toBe('100.01');
    expect(r.displayKzt).toBe(100); // целые ₸ HALF_UP от сырого 100.005
  });

  it('UNKNOWN: A_now отсутствует → value=null + MISSING_REQUIRED_INPUT (не ноль)', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: null });
    expect(r.value).toBeNull();
    expect(r.displayKzt).toBeNull();
    expect(r.blocker).toBe('MISSING_REQUIRED_INPUT');
  });

  it('UNKNOWN: P отсутствует → value=null + MISSING_REQUIRED_INPUT', () => {
    const r = requiredFinancing({ targetPrice: undefined, availableNowDownPayment: 5_000_000 });
    expect(r.blocker).toBe('MISSING_REQUIRED_INPUT');
  });

  it('invalid: отрицательная цена → INVALID_INPUT', () => {
    const r = requiredFinancing({ targetPrice: -1, availableNowDownPayment: 0 });
    expect(r.blocker).toBe('INVALID_INPUT');
    expect(r.value).toBeNull();
  });
});

describe('CALC-F-002 casa.annuity_payment_by_parameters v1.0.0', () => {
  it('P=0 → M=0', () => {
    const r = annuityPaymentByParameters({ principal: 0, annualNominalRatePercent: 18.5, termMonths: 240 });
    expect(r.blocker).toBeNull();
    expect(r.value).toBe('0.00');
    expect(r.displayKzt).toBe(0);
  });

  it('r=0 (ставка 0%), n>0 → M=P/n', () => {
    const r = annuityPaymentByParameters({ principal: 1_200_000, annualNominalRatePercent: 0, termMonths: 12 });
    expect(r.value).toBe('100000.00');
    expect(r.displayKzt).toBe(100_000);
  });

  it('r>0, n>0 → аннуитет (P=1 000 000, a=12%, n=12 → 88 848.79)', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 12 });
    expect(r.blocker).toBeNull();
    expect(r.value).toBe('88848.79');
    expect(r.displayKzt).toBe(88_849);
  });

  it('boundary: n=1 → платёж = P·(1+r) при r>0', () => {
    // r=0.01, factor=1.01, M = P·r·1.01/(1.01−1) = P·1.01 = 1 010 000
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 1 });
    expect(r.value).toBe('1010000.00');
  });

  it('UNKNOWN: principal отсутствует → value=null + MISSING_REQUIRED_INPUT', () => {
    const r = annuityPaymentByParameters({ principal: null, annualNominalRatePercent: 12, termMonths: 12 });
    expect(r.value).toBeNull();
    expect(r.blocker).toBe('MISSING_REQUIRED_INPUT');
  });

  it('UNKNOWN: rate отсутствует → MISSING_REQUIRED_INPUT', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: null, termMonths: 12 });
    expect(r.blocker).toBe('MISSING_REQUIRED_INPUT');
  });

  it('invalid: term=0 → INVALID_INPUT', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 0 });
    expect(r.blocker).toBe('INVALID_INPUT');
  });

  it('invalid: нецелый term → INVALID_INPUT', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 12.5 });
    expect(r.blocker).toBe('INVALID_INPUT');
  });

  it('invalid: отрицательная ставка → INVALID_INPUT', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: -5, termMonths: 12 });
    expect(r.blocker).toBe('INVALID_INPUT');
  });

  it('invalid: частота не MONTHLY → INVALID_INPUT', () => {
    const r = annuityPaymentByParameters({
      principal: 1_000_000,
      annualNominalRatePercent: 12,
      termMonths: 12,
      // @ts-expect-error — намеренно неверная частота для проверки контракта
      paymentFrequency: 'WEEKLY',
    });
    expect(r.blocker).toBe('INVALID_INPUT');
  });
});
