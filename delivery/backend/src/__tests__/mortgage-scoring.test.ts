/**
 * CASA-скоринг доступности: вердикт «потянет ли клиент эту квартиру».
 *
 * Проверяется не «функция что-то вернула», а три обещания модуля:
 *  1) UNKNOWN ≠ 0 — без входа выдаётся NEEDS_DATA со списком действий, а не
 *     число, посчитанное от нуля;
 *  2) арифметика согласована с движком M06 (платёж по кредиту, который
 *     вытягивает свободный платёж, обратим в этот же платёж);
 *  3) вердикт честный: превышение платежа даёт NOT_ENOUGH с размером разрыва.
 */

import { describe, it, expect } from 'vitest';
import { scoreMortgage, DEFAULT_PAYMENT_SHARE_PERCENT } from '../lib/mortgage-workspace/scoring';
import { annuityPaymentByParameters } from '../lib/mortgage-workspace/m06-calc';

const BASE = {
  targetPrice: '30000000',
  availableNowDownPayment: '9000000',
  monthlyIncome: '1200000',
  monthlyCreditPayments: '211711.02',
  annualNominalRatePercent: '12.5',
  termMonths: 240,
};

describe('CASA-скоринг: недостающие данные', () => {
  it('без дохода — NEEDS_DATA и указание, что сделать', () => {
    const r = scoreMortgage({ ...BASE, monthlyIncome: null });
    expect(r.verdict).toBe('NEEDS_DATA');
    expect(r.paymentCapacity.value).toBeNull(); // не ноль
    expect(r.missing.map((m) => m.field)).toContain('monthly_income');
    expect(r.missing.find((m) => m.field === 'monthly_income')?.action).toMatch(/доход/i);
  });

  it('без загруженной кредитной истории просит именно её, а не «введите платежи»', () => {
    const r = scoreMortgage({ ...BASE, monthlyCreditPayments: { value: null, status: 'MISSING' } });
    expect(r.verdict).toBe('NEEDS_DATA');
    expect(r.missing.find((m) => m.field === 'monthly_credit_payments')?.action).toMatch(/ПКБ/);
  });

  it('UNKNOWN-взнос не превращается в ноль', () => {
    const r = scoreMortgage({
      ...BASE,
      availableNowDownPayment: { value: null, status: 'UNKNOWN' },
    });
    expect(r.verdict).toBe('NEEDS_DATA');
    expect(r.maxLoan.value).toBeNull();
  });
});

describe('CASA-скоринг: рабочий расчёт', () => {
  const r = scoreMortgage(BASE);

  it('нужная сумма кредита = цена минус взнос', () => {
    expect(r.requiredFinancing.value).toBe('21000000.00');
  });

  it('свободный платёж = доля дохода минус текущие платежи', () => {
    // 1 200 000 × 50% − 211 711,02 = 388 288,98
    expect(r.paymentCapacity.value).toBe('388288.98');
    expect(r.parameters.paymentSharePercent).toBe(DEFAULT_PAYMENT_SHARE_PERCENT);
  });

  it('максимальный кредит обратим в свободный платёж через M06', () => {
    // Обратный аннуитет должен быть согласован с прямым: платёж по максимальному
    // кредиту равен свободному платежу (до копейки персиста).
    const back = annuityPaymentByParameters({
      principal: r.maxLoan.value,
      annualNominalRatePercent: '12.5',
      termMonths: 240,
    });
    expect(back.value).toBe(r.paymentCapacity.value);
  });

  it('вердикт FITS, когда платёж укладывается в свободный', () => {
    expect(r.verdict).toBe('FITS');
    expect(r.codes).toContain('WITHIN_CAPACITY');
    expect(r.paymentGap.value).toBe('0.00');
    expect(r.loanGap.value).toBe('0.00');
  });

  it('не выдаёт себя за решение банка и не считает КДН', () => {
    expect(r.disclaimer).toMatch(/не решение банка/i);
    expect(r.disclaimer).toMatch(/не расчёт банковского КДН/i);
    // Дисклеймер сам произносит запрещённые слова, чтобы сказать «этого нет»;
    // проверяем ОСТАЛЬНОЙ ответ, иначе тест ловил бы собственное отрицание.
    const withoutDisclaimer = JSON.stringify({ ...r, disclaimer: undefined });
    expect(withoutDisclaimer).not.toMatch(/вероятность одобрен/i);
    expect(withoutDisclaimer).not.toMatch(/КДН/);
  });
});

describe('CASA-скоринг: не тянет', () => {
  // 700 000 x 50% - 211 711,02 = 138 288,98 свободного платежа: он есть,
  // но на 21 млн не хватает.
  const r = scoreMortgage({ ...BASE, monthlyIncome: '700000' });

  it('вердикт NOT_ENOUGH с размером разрыва по платежу и по сумме', () => {
    expect(r.verdict).toBe('NOT_ENOUGH');
    expect(r.codes).toContain('EXCEEDS_CAPACITY');
    expect(Number(r.paymentGap.value)).toBeGreaterThan(0);
    expect(Number(r.loanGap.value)).toBeGreaterThan(0);
  });

  it('всё равно показывает, сколько клиент тянет', () => {
    expect(Number(r.maxLoan.value)).toBeGreaterThan(0);
    expect(Number(r.maxLoan.value)).toBeLessThan(Number(r.requiredFinancing.value));
  });
});

describe('CASA-скоринг: краевые случаи', () => {
  it('обязательства съедают весь доход → свободного платежа нет, но не отрицательный', () => {
    const r = scoreMortgage({ ...BASE, monthlyIncome: '300000', monthlyCreditPayments: '400000' });
    expect(r.paymentCapacity.value).toBe('0.00');
    expect(r.maxLoan.value).toBe('0.00');
    expect(r.codes).toContain('NO_FREE_PAYMENT_CAPACITY');
    expect(r.verdict).toBe('NOT_ENOUGH');
  });

  it('взнос покрывает цену → кредит не нужен, вердикт FITS', () => {
    const r = scoreMortgage({ ...BASE, availableNowDownPayment: '30000000' });
    expect(r.requiredFinancing.value).toBe('0.00');
    expect(r.verdict).toBe('FITS');
    expect(r.codes).toContain('NO_FINANCING_NEEDED');
  });

  it('цена конкретной квартиры важнее сохранённой цели: другая цена — другой вердикт', () => {
    const cheap = scoreMortgage({ ...BASE, monthlyIncome: '700000', targetPrice: '11000000' });
    const dear = scoreMortgage({ ...BASE, monthlyIncome: '700000', targetPrice: '40000000' });
    expect(cheap.verdict).toBe('FITS');
    expect(dear.verdict).toBe('NOT_ENOUGH');
  });

  it('заявленные (не подтверждённые) входы помечаются', () => {
    const r = scoreMortgage({
      ...BASE,
      monthlyIncome: { value: '1200000', status: 'DECLARED' },
    });
    expect(r.unverifiedInputs).toBe(true);
    expect(r.codes).toContain('UNVERIFIED_INPUTS');
  });

  it('некорректная доля дохода отвергается, а не подставляется молча', () => {
    const r = scoreMortgage({ ...BASE, paymentSharePercent: '150' });
    expect(r.verdict).toBe('INVALID_INPUT');
    expect(r.codes).toContain('INVALID_PAYMENT_SHARE');
  });
});
