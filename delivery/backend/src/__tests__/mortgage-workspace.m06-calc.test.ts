import { describe, it, expect } from 'vitest';
import {
  requiredFinancing,
  annuityPaymentByParameters,
} from '../lib/mortgage-workspace/m06-calc';

/**
 * RG10 runtime-evidence: точный прогон всех 19 канонических фикстур M06
 * (M06_FIXTURES.csv §28–§29). Проверяются persisted value, display, status и
 * коды §19. Прогон НЕ переводит RG10/RG11/RG12 в PASS (DEC-RG10-001) — это
 * часть доказательной базы, которую фиксирует владелец.
 */

describe('CALC-F-001 casa.required_financing — фикстуры FX-FIN-001…009', () => {
  it('FX-FIN-001: P=30M, A=5M → 25M, COMPLETED', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 5_000_000 });
    expect(r.value).toBe('25000000.00');
    expect(r.displayKzt).toBe(25_000_000);
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual([]);
  });
  it('FX-FIN-002: P=30M, A=0 → 30M, COMPLETED', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 0 });
    expect(r.value).toBe('30000000.00');
    expect(r.displayKzt).toBe(30_000_000);
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual([]);
  });
  it('FX-FIN-003: A=P → 0, COMPLETED + DOWN_PAYMENT_COVERS_TARGET', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 30_000_000 });
    expect(r.value).toBe('0.00');
    expect(r.displayKzt).toBe(0);
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual(['DOWN_PAYMENT_COVERS_TARGET']);
  });
  it('FX-FIN-004: A>P → 0, COMPLETED + DOWN_PAYMENT_COVERS_TARGET', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 35_000_000 });
    expect(r.value).toBe('0.00');
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual(['DOWN_PAYMENT_COVERS_TARGET']);
  });
  it('FX-FIN-005: P=MISSING → BLOCKED, MISSING_INPUT:P', () => {
    const r = requiredFinancing({ targetPrice: { status: 'MISSING' }, availableNowDownPayment: 5_000_000 });
    expect(r.value).toBeNull();
    expect(r.status).toBe('BLOCKED');
    expect(r.codes).toEqual(['MISSING_INPUT:P']);
  });
  it('FX-FIN-006: A=UNKNOWN → BLOCKED, UNKNOWN_INPUT:A', () => {
    const r = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: { status: 'UNKNOWN' } });
    expect(r.value).toBeNull();
    expect(r.status).toBe('BLOCKED');
    expect(r.codes).toEqual(['UNKNOWN_INPUT:A']);
  });
  it('FX-FIN-007: P=-1 → INVALID_INPUT, NEGATIVE_AMOUNT:P', () => {
    const r = requiredFinancing({ targetPrice: -1, availableNowDownPayment: 0 });
    expect(r.value).toBeNull();
    expect(r.status).toBe('INVALID_INPUT');
    expect(r.codes).toEqual(['NEGATIVE_AMOUNT:P']);
  });
  it('FX-FIN-008: P=STALE, A=CONFLICT → BLOCKED, оба кода', () => {
    const r = requiredFinancing({
      targetPrice: { value: 30_000_000, status: 'STALE' },
      availableNowDownPayment: { value: 5_000_000, status: 'CONFLICT' },
    });
    expect(r.value).toBeNull();
    expect(r.status).toBe('BLOCKED');
    expect(r.codes).toEqual(['STALE_INPUT:P', 'CONFLICTING_INPUT:A']);
  });
  it('FX-FIN-009: DECLARED/EVIDENCE_REQUESTED → 25M, COMPLETED_WITH_LIMITATIONS + UNVERIFIED_INPUTS', () => {
    const r = requiredFinancing({
      targetPrice: { value: 30_000_000, status: 'DECLARED' },
      availableNowDownPayment: { value: 5_000_000, status: 'EVIDENCE_REQUESTED' },
    });
    expect(r.value).toBe('25000000.00');
    expect(r.displayKzt).toBe(25_000_000);
    expect(r.status).toBe('COMPLETED_WITH_LIMITATIONS');
    expect(r.codes).toEqual(['UNVERIFIED_INPUTS']);
  });
});

describe('CALC-F-002 casa.annuity_payment_by_parameters — фикстуры FX-ANN-001…009', () => {
  it('FX-ANN-001: P=25M, a=12.5%, n=240 → 284035.14 (golden аннуитет)', () => {
    const r = annuityPaymentByParameters({ principal: 25_000_000, annualNominalRatePercent: 12.5, termMonths: 240 });
    expect(r.value).toBe('284035.14');
    expect(r.displayKzt).toBe(284_035);
    expect(r.status).toBe('COMPLETED');
    // сырое 50-знаков — основа для golden/replay-хэша
    expect(r.raw?.startsWith('284035.137428592373')).toBe(true);
  });
  it('FX-ANN-002: P=0 → 0, COMPLETED', () => {
    const r = annuityPaymentByParameters({ principal: 0, annualNominalRatePercent: 12.5, termMonths: 240 });
    expect(r.value).toBe('0.00');
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual([]);
  });
  it('FX-ANN-003: a=0%, n=12, P=12M → 1 000 000, ZERO_RATE_BRANCH', () => {
    const r = annuityPaymentByParameters({ principal: 12_000_000, annualNominalRatePercent: 0, termMonths: 12 });
    expect(r.value).toBe('1000000.00');
    expect(r.displayKzt).toBe(1_000_000);
    expect(r.status).toBe('COMPLETED');
    expect(r.codes).toEqual(['ZERO_RATE_BRANCH']);
  });
  it('FX-ANN-004: n=1, a=12%, P=1M → 1 010 000', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 1 });
    expect(r.value).toBe('1010000.00');
    expect(r.status).toBe('COMPLETED');
  });
  it('FX-ANN-005: n=0 → INVALID_INPUT, INVALID_TERM', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 0 });
    expect(r.status).toBe('INVALID_INPUT');
    expect(r.codes).toEqual(['INVALID_TERM']);
  });
  it('FX-ANN-006: a=-0.0001% → INVALID_INPUT, INVALID_RATE', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: '-0.0001', termMonths: 12 });
    expect(r.status).toBe('INVALID_INPUT');
    expect(r.codes).toEqual(['INVALID_RATE']);
  });
  it('FX-ANN-007: a=MISSING → BLOCKED, MISSING_INPUT:a', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: { status: 'MISSING' }, termMonths: 12 });
    expect(r.status).toBe('BLOCKED');
    expect(r.codes).toEqual(['MISSING_INPUT:a']);
  });
  it('FX-ANN-008: P=UNKNOWN → BLOCKED, UNKNOWN_INPUT:P', () => {
    const r = annuityPaymentByParameters({ principal: { status: 'UNKNOWN' }, annualNominalRatePercent: 12, termMonths: 12 });
    expect(r.status).toBe('BLOCKED');
    expect(r.codes).toEqual(['UNKNOWN_INPUT:P']);
  });
  it('FX-ANN-009: источник STALE/CONFLICT → BLOCKED', () => {
    const r = annuityPaymentByParameters({ principal: { value: 25_000_000, status: 'STALE' }, annualNominalRatePercent: 12.5, termMonths: 240 });
    expect(r.status).toBe('BLOCKED');
    expect(r.codes[0]).toMatch(/STALE_INPUT|CONFLICTING_INPUT/);
  });
  // Дополнительные граничные проверки §19 (сверх фикстур).
  it('§19: n>1200 → INVALID_TERM', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 1201 });
    expect(r.codes).toEqual(['INVALID_TERM']);
  });
  it('§19: a>100 → INVALID_RATE', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 101, termMonths: 12 });
    expect(r.codes).toEqual(['INVALID_RATE']);
  });
  it('§19: частота ≠ MONTHLY → UNSUPPORTED_FREQUENCY', () => {
    const r = annuityPaymentByParameters({ principal: 1_000_000, annualNominalRatePercent: 12, termMonths: 12, paymentFrequency: 'WEEKLY' });
    expect(r.codes).toEqual(['UNSUPPORTED_FREQUENCY']);
  });
});

describe('FX-CALC-GOLDEN-001 — числовая часть golden (хэш-replay CASA-CJ-1 — см. прим.)', () => {
  it('required_financing=25M и annuity=284035.14 из одного набора входов', () => {
    const rf = requiredFinancing({ targetPrice: 30_000_000, availableNowDownPayment: 5_000_000 });
    const ann = annuityPaymentByParameters({
      principal: Number(rf.value), // 25 000 000
      annualNominalRatePercent: 12.5,
      termMonths: 240,
    });
    expect(rf.value).toBe('25000000.00');
    expect(ann.value).toBe('284035.14');
    expect(ann.displayKzt).toBe(284_035);
  });
  // Хэш-replay CASA-CJ-1 (cb88…/c167…/a7be…) реализован по §29 Production Spec
  // v1.4 и проверяется в m06-golden.test.ts. Прежний it.todo здесь утверждал,
  // что §29 недоступен — это было неверно: раздел есть в .docx в репозитории.
});
