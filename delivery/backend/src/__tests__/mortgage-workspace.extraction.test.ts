import { describe, it, expect } from 'vitest';
import { extractCreditHistory, extractPension, extractDocument } from '../lib/mortgage-workspace/extraction';

const ENPF_SAMPLE = `
Государственная корпорация «Правительство для граждан»
Справка о поступлении и движении средств вкладчика ЕНПФ № 61674534
Период запроса: 08.02.2026 – 08.08.2026
Получено: 08.08.2026 09:56:29
Строка  Период      КНП   Сумма         Статус        Отправитель
1       01.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
2       02.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
3       03.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
4       04.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
5       05.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
6       06.2026     010   10 000,00 KZT ОБРАБОТАННЫЕ  ИП RSHATOVA
`;

const CREDIT_SAMPLE = `
ТОО «Первое кредитное бюро» (ПКБ)
Полный персональный кредитный отчёт
Сформирован: 08.08.2026 09:51:38
Страница 1/29
ПКР 636
КОНТРАКТ 1 Kaspi Bank ... Максимальная просрочка 60 дней
КОНТРАКТ 2 Halyk Bank ...
Текущий остаток задолженности 4 737 798,64 KZT
`;

describe('ЕНПФ extraction — жёсткие инварианты спецификации', () => {
  const r = extractPension(ENPF_SAMPLE);

  it('распознаёт КНП 010 как OPV', () => {
    const knp = r.fields.find((f) => f.key === 'payment_code');
    const type = r.fields.find((f) => f.key === 'contribution_type');
    expect(knp?.normalizedValue).toBe('010');
    expect(type?.normalizedValue).toBe('OPV');
  });

  it('НЕ показывает угаданный доход из ОПВ (UNKNOWN_RATE_CONTEXT, база=null)', () => {
    const income = r.fields.find((f) => f.key === 'estimated_income_from_opv');
    expect(income).toBeTruthy();
    expect(income?.presence).toBe('UNKNOWN');
    expect(income?.normalizedValue).toBeNull();
    // нигде не всплыл угаданный 100000
    const anyGuessed = r.fields.some((f) => f.normalizedValue === 100000);
    expect(anyGuessed).toBe(false);
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

  it('подлинность не авто-подтверждается (MANUAL_REVIEW_REQUIRED)', () => {
    expect(r.statuses.authenticity).toBe('MANUAL_REVIEW_REQUIRED');
    expect(r.reviewRequired).toBe(true);
  });
});

describe('диспетчер extractDocument', () => {
  it('роутит по типу', () => {
    expect(extractDocument('enpf_statement', ENPF_SAMPLE).docType).toBe('enpf_statement');
    expect(extractDocument('credit_history', CREDIT_SAMPLE).docType).toBe('credit_history');
  });
});
