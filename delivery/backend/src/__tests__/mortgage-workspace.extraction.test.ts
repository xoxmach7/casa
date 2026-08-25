import { describe, it, expect } from 'vitest';
import {
  extractCreditHistory, extractPension, extractDocument,
  pensionContributionBase,
} from '../lib/mortgage-workspace/extraction';

// Структура повторяет реальный вывод pdf-parse по шаблону GOVCORP ЕНПФ:
// колонки идут отдельными строками (КНП, отправитель, сумма, период, статус).
const ENPF_SAMPLE = `
Информация о поступлении и движении средств вкладчика ЕНПФ № 61674534
Период запроса
08.02.2026 - 08.08.2026
ТТК/КНП
Сумма
Мәртебе/Статус
Мерзім/Период
19.02.2026
18
010
ИП RSHATOVA
930000000000
10000,00
01.2026
ОБРАБОТАННЫЕ
26.03.2026
29
010
ИП RSHATOVA
930000000000
10000,00
02.2026
ОБРАБОТАННЫЕ
010
10000,00
03.2026
ОБРАБОТАННЫЕ
010
10000,00
04.2026
ОБРАБОТАННЫЕ
010
10000,00
05.2026
ОБРАБОТАННЫЕ
010
10000,00
06.2026
ОБРАБОТАННЫЕ
`;

// Структура и написание — как в реальном отчёте ПКБ (счётчики склеены с числом,
// «отчет»/«Завершенные» без ё, суммы с точкой-десятичной).
const CREDIT_SAMPLE = `
Первое кредитное бюро (ПКБ)
Полный персональный кредитный отчет
Сформирован: 08.08.2026 09:51:38
Страница 1/29
ПКР 636
2Действующие договоры без просрочки
1Действующие договоры с просрочкой
23Завершенные договоры без просрочки
1Завершенные договоры с просрочкой
0Отозванные договоры
КОНТРАКТ 1 Kaspi Bank Максимальная просрочка 60 дней
Текущий остаток задолженности 4 737 798.64 KZT
`;

describe('ЕНПФ extraction — жёсткие инварианты спецификации', () => {
  const r = extractPension(ENPF_SAMPLE);

  it('распознаёт КНП 010 как OPV', () => {
    const knp = r.fields.find((f) => f.key === 'payment_code');
    const type = r.fields.find((f) => f.key === 'contribution_type');
    expect(knp?.normalizedValue).toBe('010');
    expect(type?.normalizedValue).toBe('OPV');
  });

  it('НЕ вычисляет доход из ОПВ — расчётная база = null, UNKNOWN_RATE_CONTEXT (M04/RG-04)', () => {
    // Governance 2026-08-25: формула ОПВ/10% откачена; никакого угаданного дохода.
    expect(r.derived.estimated_contribution_base).toBeNull();
    expect(r.derived.estimate_status).toBe('UNKNOWN_RATE_CONTEXT');
    // Старые поля дохода/лимита не выпускаются вовсе.
    expect(r.fields.find((f) => f.key === 'estimated_monthly_income')).toBeUndefined();
    expect(r.fields.find((f) => f.key === 'estimated_payment_limit')).toBeUndefined();
    const cbase = r.fields.find((f) => f.key === 'estimated_contribution_base');
    expect(cbase?.presence).toBe('UNKNOWN');
    expect(cbase?.normalizedValue).toBeNull();
  });

  it('covered_month_count = null (UNKNOWN), но наблюдаемые месяцы посчитаны', () => {
    expect(r.derived.covered_month_count).toBeNull();
    expect(Number(r.derived.observed_month_count)).toBeGreaterThan(0);
  });

  it('требует ручной проверки и несёт gate SAMPLE_REQUIRED/LEGAL', () => {
    expect(r.reviewRequired).toBe(true);
    expect(r.gates.join(' ')).toMatch(/SAMPLE_REQUIRED|LEGAL_REVIEW_REQUIRED/);
  });
});

describe('Кредитная история extraction', () => {
  const r = extractCreditHistory(CREDIT_SAMPLE);

  it('распознаёт бюро ПКБ (FCB) и тип полного отчёта', () => {
    expect(r.fields.find((f) => f.key === 'bureau')?.normalizedValue).toBe('FCB');
    expect(r.fields.find((f) => f.key === 'report_kind')?.normalizedValue).toBe('FULL_PERSONAL');
  });

  it('извлекает дату формирования и текущий остаток', () => {
    expect(r.fields.find((f) => f.key === 'report_generated_at')?.presence).toBe('PRESENT');
    const bal = r.fields.find((f) => f.key === 'outstanding_total_reported');
    expect(bal?.presence).toBe('PRESENT');
    expect(bal?.normalizedValue).toBe(4737798.64);
  });

  it('извлекает сводные счётчики договоров (реальные якоря ПКБ)', () => {
    const get = (k: string) => r.fields.find((f) => f.key === k)?.normalizedValue;
    expect(get('active_without_overdue')).toBe(2);
    expect(get('active_with_overdue')).toBe(1);
    expect(get('closed_without_overdue')).toBe(23);
    expect(get('closed_with_overdue')).toBe(1);
    expect(get('recalled_contracts')).toBe(0);
  });

  it('распознаёт шаблон ПКБ как SUPPORTED', () => {
    expect(r.template).toBe('FCB_FULL_PERSONAL_PDF');
  });

  it('подлинность не авто-подтверждается (MANUAL_REVIEW_REQUIRED)', () => {
    expect(r.statuses.authenticity).toBe('MANUAL_REVIEW_REQUIRED');
    expect(r.reviewRequired).toBe(true);
  });
});

describe('М04 расчётная база — строго по спеке (без ОПВ→доход)', () => {
  it('pensionContributionBase() = null + UNKNOWN_RATE_CONTEXT до RG-04', () => {
    const b = pensionContributionBase();
    expect(b.estimated_contribution_base).toBeNull();
    expect(b.estimate_status).toBe('UNKNOWN_RATE_CONTEXT');
    expect(b.reason).toMatch(/E-01|RG-04|UNKNOWN/i);
  });
});

describe('диспетчер extractDocument', () => {
  it('роутит по типу', () => {
    expect(extractDocument('enpf_statement', ENPF_SAMPLE).docType).toBe('enpf_statement');
    expect(extractDocument('credit_history', CREDIT_SAMPLE).docType).toBe('credit_history');
  });
});
