import { describe, it, expect } from 'vitest';
import { aggregateMoney, profileContentHash } from '../lib/mortgage-workspace/mortgage-profile.service';

describe('aggregateMoney — available_now_total (UNKNOWN ≠ 0)', () => {
  it('все VERIFIED → сумма, статус CONFIRMED', () => {
    const a = aggregateMoney([
      { amount: 1_000_000, status: 'VERIFIED' },
      { amount: 2_000_000, status: 'VERIFIED' },
    ]);
    expect(a.value).toBe('3000000.00');
    expect(a.status).toBe('CONFIRMED');
    expect(a.complete).toBe(true);
    expect(a.counted).toBe(2);
  });

  it('есть DECLARED → статус DECLARED (не подтверждено)', () => {
    const a = aggregateMoney([
      { amount: 1_000_000, status: 'VERIFIED' },
      { amount: 2_000_000, status: 'DECLARED' },
    ]);
    expect(a.value).toBe('3000000.00');
    expect(a.status).toBe('DECLARED');
  });

  it('источник с UNKNOWN/пустой суммой НЕ считается нулём → value null, UNKNOWN', () => {
    const a = aggregateMoney([
      { amount: 1_000_000, status: 'VERIFIED' },
      { amount: null, status: 'UNKNOWN' },
    ]);
    expect(a.value).toBeNull(); // не 1M и не 0 — агрегат неполон
    expect(a.status).toBe('UNKNOWN');
    expect(a.complete).toBe(false);
  });

  it('пустой список → value 0.00 CONFIRMED (нет неизвестных)', () => {
    const a = aggregateMoney([]);
    expect(a.value).toBe('0.00');
    expect(a.status).toBe('CONFIRMED');
  });

  it('profileContentHash детерминирован', () => {
    const h1 = profileContentHash({ b: 1, a: 2 });
    const h2 = profileContentHash({ a: 2, b: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});
