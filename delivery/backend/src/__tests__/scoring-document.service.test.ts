import { describe, it, expect } from 'vitest';
import {
  extractCreditHistoryStatus,
  extractAvgMonthlyPension,
  extractExistingMonthlyDebt,
} from '../lib/scoring-document.service';

describe('extractCreditHistoryStatus', () => {
  it('detects an active/current delinquency as BAD', () => {
    const text = 'Отчёт по заёмщику. Статус: текущая просрочка 45 дней.';
    expect(extractCreditHistoryStatus(text).status).toBe('BAD');
  });

  it('detects a past, resolved delay as HAS_DELAYS', () => {
    const text = 'История платежей: просрочка погашена в 2023 году, счёт закрыт вовремя.';
    expect(extractCreditHistoryStatus(text).status).toBe('HAS_DELAYS');
  });

  it('defaults to GOOD when no delinquency phrases are present', () => {
    const text = 'Кредитная история клиента: все платежи вносились своевременно.';
    expect(extractCreditHistoryStatus(text).status).toBe('GOOD');
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    const text = 'ТЕКУЩАЯ   ПРОСРОЧКА по договору №123';
    expect(extractCreditHistoryStatus(text).status).toBe('BAD');
  });
});

describe('extractAvgMonthlyPension', () => {
  it('averages every currency-tagged amount found in the text', () => {
    const text = `
      Выписка ЕНПФ
      Январь 2026: перечисление 150 000 тенге
      Февраль 2026: перечисление 150 000 тенге
      Март 2026: перечисление 180 000 тенге
    `;
    const result = extractAvgMonthlyPension(text);
    expect(result.matchesFound).toBe(3);
    expect(result.averageAmount).toBe(160000);
  });

  it('returns zero when no amounts are found', () => {
    const result = extractAvgMonthlyPension('Документ без сумм и валюты.');
    expect(result.matchesFound).toBe(0);
    expect(result.averageAmount).toBe(0);
  });

  it('handles thousand separators (spaces) in amounts', () => {
    const result = extractAvgMonthlyPension('Сумма взноса: 95 500 тг.');
    expect(result.averageAmount).toBe(95500);
  });
});

describe('extractExistingMonthlyDebt', () => {
  it('sums amounts following known monthly-payment labels', () => {
    const text = `
      Кредит 1: ежемесячный платеж 85 000 тенге
      Кредит 2: ежемесячный платеж 40 000 тенге
    `;
    const result = extractExistingMonthlyDebt(text);
    expect(result.matchesFound).toBe(2);
    expect(result.totalAmount).toBe(125000);
  });

  it('returns zero when the document has no loan-payment labels', () => {
    const result = extractExistingMonthlyDebt('Справка не содержит активных кредитов.');
    expect(result.matchesFound).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});
