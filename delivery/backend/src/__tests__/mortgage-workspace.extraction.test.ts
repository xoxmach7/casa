import { describe, it, expect } from 'vitest';
import {
  extractCreditHistory, extractPension, extractDocument,
  pensionContributionBase, aggregateCreditContracts,
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

  it('извлекает дату формирования', () => {
    expect(r.fields.find((f) => f.key === 'report_generated_at')?.presence).toBe('PRESENT');
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

// Синтетика по разметке реального полного отчёта ПКБ: строка баланса печатается
// ЧУТЬ ВЫШЕ маркера «Вид финансирования», «Фаза договора» — статус; блоки DPD —
// ниже. Значения фейковые. Между договорами — паддинг (в реальном отчёте блоки
// далеко друг от друга), чтобы окна агрегатора не перекрывались.
function pad(n: number): string[] { return Array(n).fill('   прочая строка отчёта'); }
const PKB_CONTRACTS_LINES: string[] = [
  // Договор 1 — действующий заём
  'Общая сумма кредита / валюта :5 000 000.00KZTСумма просроченных взносов:0 KZT',
  'Информация по состоянию на:01.08.2026Непогашенная сумма по кредиту :3 200 000.00 KZTКоличество дней просрочки :0',
  'Вид финансирования:Займ',
  'Фаза договора :Действующий',
  'Максимальное количество дней просрочки с начала действия договора :12',
  'Количество дней просрочки :0',
  ...pad(20),
  // Договор 2 — действующая карта с минимальным платежом
  'Информация по состоянию на:01.08.2026Использованная сумма (подлежащая погашению) :400 000.00 KZT',
  'Вид финансирования:Кредитная карта',
  'Фаза договора :Действующий',
  'Количество дней просрочки :5',
  'Минимальный платеж :40 000 KZT',
  'Максимальное количество дней просрочки с начала действия договора :5',
  ...pad(20),
  // Договор 3 — завершённый (в сумму действующих не входит; в макс.DPD — да)
  'Вид финансирования:Займ',
  'Фаза договора :Завершен',
  'Максимальное количество дней просрочки с начала действия договора :3',
];

describe('ПКБ агрегатор договоров — постро́чный разбор действующих', () => {
  const agg = aggregateCreditContracts(PKB_CONTRACTS_LINES);

  it('считает число действующих договоров по «Фаза договора»', () => {
    expect(agg.activeContracts).toBe(2);
  });
  it('суммирует остаток ТОЛЬКО по действующим (3.2M + 400k = 3.6M)', () => {
    expect(agg.outstandingActiveSum).toBe(3_600_000);
    expect(agg.outstandingComplete).toBe(true);
  });
  it('текущий DPD = макс по действующим; макс.DPD за всё время — по всем', () => {
    expect(agg.currentDpdMaxActive).toBe(5);
    expect(agg.lifetimeMaxDpd).toBe(12); // 12 из завершённого договора учитывается
  });
  it('ежемесячный платёж — только там где есть; покрытие честное (1 из 2)', () => {
    expect(agg.existingMonthlyPaymentSum).toBe(40_000);
    expect(agg.monthlyPaymentCovered).toBe(1);
  });
  it('если по активному остаток UNKNOWN — сумма не выдумывается (null)', () => {
    const partial = aggregateCreditContracts([
      'Вид финансирования:Займ',
      'Фаза договора :Действующий', // без строки остатка
      'Количество дней просрочки :0',
    ]);
    expect(partial.activeContracts).toBe(1);
    expect(partial.outstandingActiveSum).toBeNull();
    expect(partial.outstandingComplete).toBe(false);
  });
});

describe('ЕНПФ — месяцы из колонки периода (MMYYYY без разделителя)', () => {
  // Реальный шаблон: период печатается как «012026», а не «01.2026».
  const sample = [
    'ТТК/КНП', '010', '10000,00', '012026', 'ОБРАБОТАННЫЕ',
    '010', '10000,00', '022026', 'ОБРАБОТАННЫЕ',
    '010', '10000,00', '032026', 'ОБРАБОТАННЫЕ',
    // строки-даты шапки НЕ должны попадать в месяцы
    '08.02.2026', '26.03.2026',
  ].join('\n');
  const r = extractPension(sample);
  it('считает 3 уникальных месяца из периода, не из дат шапки', () => {
    expect(r.derived.observed_month_count).toBe(3);
  });
});

describe('М04: гейт RG-04 не должен делать выписку неподтверждаемой', () => {
  const r = extractPension(ENPF_SAMPLE);

  it('расчётная база остаётся UNKNOWN (гейт соблюдён)', () => {
    const f = r.fields.find((x) => x.key === 'estimated_contribution_base');
    expect(f?.presence).toBe('UNKNOWN');
    expect(f?.normalizedValue).toBeNull();
  });

  it('но она НЕ критичная — иначе документ невозможно подтвердить никогда', () => {
    const f = r.fields.find((x) => x.key === 'estimated_contribution_base');
    expect(f?.critical).toBe(false);
  });

  it('среди критичных полей нет вечно-UNKNOWN — подтверждение достижимо', () => {
    const blockers = r.fields.filter((f) => f.critical && f.presence === 'UNKNOWN');
    expect(blockers.map((f) => f.key)).not.toContain('estimated_contribution_base');
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
