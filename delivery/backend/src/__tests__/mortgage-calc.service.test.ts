import { describe, it, expect } from 'vitest';
import {
  runCalculation,
  canonicalJson,
  sha256Hex,
  M06_ENGINE_VERSION,
} from '../lib/mortgage-workspace/mortgage-calc.service';

describe('canonicalJson — детерминированная канонизация', () => {
  it('сортирует ключи рекурсивно → одинаковый вход даёт одинаковую строку', () => {
    const a = canonicalJson({ b: 1, a: { d: 4, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 4 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":4},"b":1}');
  });
  it('sha256Hex стабилен и 64 hex', () => {
    const h = sha256Hex('x');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('x')).toBe(h);
  });
});

describe('runCalculation — прогон M06 (required_financing → аннуитет)', () => {
  it('golden: P=30M, A=5M, a=12.5%, n=240 → фин.25M, платёж 284035.14', () => {
    const r = runCalculation({
      targetPriceMax: 30_000_000, availableNowTotal: 5_000_000,
      annualNominalRatePercent: 12.5, termMonths: 240,
    });
    expect(r.results.requiredFinancing.value).toBe('25000000.00');
    expect(r.results.annuity.value).toBe('284035.14');
    expect(r.results.annuity.displayKzt).toBe(284_035);
    expect(r.results.status).toBe('COMPLETED');
    expect(r.results.engineVersion).toBe(M06_ENGINE_VERSION);
    expect(r.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.outputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('детерминизм: одинаковые входы → одинаковые input/output hash (replay)', () => {
    const inp = { targetPriceMax: 30_000_000, availableNowTotal: 5_000_000, annualNominalRatePercent: 12.5, termMonths: 240 };
    const a = runCalculation(inp);
    const b = runCalculation(inp);
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.outputHash).toBe(b.outputHash);
  });

  it('финансирование заблокировано (P=MISSING) → аннуитет тоже BLOCKED, ноль не подставляется', () => {
    const r = runCalculation({
      targetPriceMax: { status: 'MISSING' }, availableNowTotal: 5_000_000,
      annualNominalRatePercent: 12.5, termMonths: 240,
    });
    expect(r.results.requiredFinancing.value).toBeNull();
    expect(r.results.annuity.value).toBeNull();
    expect(r.results.status).toBe('BLOCKED');
    expect(r.results.codes).toContain('MISSING_INPUT:P');
  });

  it('первый взнос покрывает цель → фин.0, платёж 0, коды прокинуты', () => {
    const r = runCalculation({
      targetPriceMax: 20_000_000, availableNowTotal: 25_000_000,
      annualNominalRatePercent: 12.5, termMonths: 240,
    });
    expect(r.results.requiredFinancing.value).toBe('0.00');
    expect(r.results.annuity.value).toBe('0.00'); // principal 0 → платёж 0
    expect(r.results.codes).toContain('DOWN_PAYMENT_COVERS_TARGET');
  });
});
