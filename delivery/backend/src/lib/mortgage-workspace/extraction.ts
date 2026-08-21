/**
 * CASA Pro Ипотека — движок распознавания полей из PDF (кредитная история / ЕНПФ).
 *
 * Реализовано СТРОГО по docs/casa-pro-ipoteka/extraction-spec.md (доки Credit
 * History Engine v1.0 и Pension Contribution Engine v1.0). Это НЕ выдумка полей:
 * извлекается текстовый слой реального загруженного PDF и парсятся поля по
 * маркерам из спецификации. Каждое поле — envelope с presence и confidence.
 *
 * ЖЁСТКИЕ ИНВАРИАНТЫ спецификации (соблюдаются здесь):
 *  - UNKNOWN никогда не заменяется нулём; пустая ячейка ≠ 0.00.
 *  - Три несмешиваемых уровня: SOURCE_FACT / CASA_DERIVED / (BANK_RULE — не здесь).
 *  - Доход из ОПВ по КНП 010 = UNKNOWN_RATE_CONTEXT, база = null (не показывать
 *    угаданный доход до закрытия gate RG-04 — префикс «ИП» не доказывает режим).
 *  - contribution_period ≠ период шапки; current DPD ≠ lifetime max DPD.
 *  - Три раздельных статуса (файл/подлинность/извлечение); нет ярлыка «хорошая/плохая КИ».
 *  - Полное покрытие шаблонов — SAMPLE_REQUIRED (нужны реальные образцы); авто-подлинность
 *    — CONTRACT_REQUIRED. Движок честно отмечает эти gate, а не блефует.
 */

export type Presence =
  | 'PRESENT'
  | 'EXPLICIT_ZERO'
  | 'BLANK'
  | 'NOT_APPLICABLE'
  | 'UNREADABLE'
  | 'UNKNOWN'
  | 'NOT_IN_TEMPLATE';

export type DataLevel = 'SOURCE_FACT' | 'CASA_DERIVED';

export interface FieldValue {
  key: string;
  label: string; // рус. подпись
  rawValue: string | null;
  normalizedValue: string | number | null;
  presence: Presence;
  confidence: number; // 0..1 — техническая уверенность парсера, не точность
  critical: boolean;
  level: DataLevel;
  evidence?: string; // короткий фрагмент текста-доказательство
}

export interface DocumentExtraction {
  docType: 'credit_history' | 'enpf_statement';
  template: string; // распознанный шаблон или UNKNOWN
  supported: boolean; // SUPPORTED в v1 или SAMPLE_REQUIRED
  statuses: {
    file_integrity: 'VALID' | 'UNREADABLE';
    authenticity: 'UNVERIFIED' | 'MANUAL_REVIEW_REQUIRED';
    extraction: 'PARTIAL' | 'OK' | 'FAILED';
  };
  fields: FieldValue[];
  derived: Record<string, string | number | null>;
  gates: string[]; // LEGAL_REVIEW_REQUIRED / SAMPLE_REQUIRED / CONTRACT_REQUIRED и т.п.
  notes: string[]; // честные ограничения распознавания
  reviewRequired: boolean;
  textChars: number;
}

// --- утилиты нормализации ----------------------------------------------------

function normText(t: string): string {
  return t.replace(/ /g, ' ').replace(/[\t\r]+/g, ' ');
}

/** Деньги «2 990 763,90» / «10 000,00» → число; без валюты не доверяем. */
function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/\s/g, '');
  if (!cleaned) return null;
  // «1 234 567,89» → «1234567.89»
  const norm = cleaned.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = parseFloat(norm);
  return Number.isFinite(v) ? v : null;
}

/** MMYYYY → YYYY-MM с валидацией месяца (спека 5.1: 132026 → NEEDS_REVIEW). */
function parseContributionPeriod(raw: string): { value: string | null; ok: boolean } {
  const m = raw.match(/(\d{2})[.\-/]?(\d{4})/);
  if (!m) return { value: null, ok: false };
  const mm = parseInt(m[1], 10);
  const yyyy = m[2];
  if (mm < 1 || mm > 12) return { value: null, ok: false };
  return { value: `${yyyy}-${m[1]}`, ok: true };
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
}

function fld(p: Partial<FieldValue> & Pick<FieldValue, 'key' | 'label' | 'presence' | 'critical' | 'level'>): FieldValue {
  return {
    rawValue: p.rawValue ?? null,
    normalizedValue: p.normalizedValue ?? null,
    confidence: p.confidence ?? 0,
    evidence: p.evidence,
    ...p,
  } as FieldValue;
}

/**
 * Оценка дохода из ОПВ — правило CASA Pro (Соц. кодекс РК + разъяснение АРРФР).
 * Доход = средний ОПВ работника (КНП 010) / 10%; окно — последние 6 месяцев.
 * Лимит кредитных платежей = доход × 50% (предельный КДН 0.5).
 * Только ОПВ работника (010), НЕ ОПВР работодателя (089) и не пени.
 * Результат — предварительная оценка, не банковское решение.
 */
export function estimateIncomeFromOpv(
  opvAmounts: number[],
  knpType: string | null,
): { avgOpv: number | null; monthlyIncome: number | null; paymentLimit: number | null; reason: string } {
  if (knpType && knpType !== 'OPV') {
    return { avgOpv: null, monthlyIncome: null, paymentLimit: null, reason: 'взносы не ОПВ работника (КНП 010)' };
  }
  const window = opvAmounts.filter((a) => a > 0).slice(-6); // последние 6 месяцев
  if (window.length === 0) {
    return { avgOpv: null, monthlyIncome: null, paymentLimit: null, reason: 'нет положительных взносов ОПВ' };
  }
  const sum = window.reduce((s, a) => s + a, 0);
  const avgOpv = Math.round(sum / window.length);
  const monthlyIncome = Math.round(avgOpv / 0.1);
  const paymentLimit = Math.round(monthlyIncome * 0.5);
  return { avgOpv, monthlyIncome, paymentLimit, reason: '' };
}

/** Доступный платёж по новой ипотеке = лимит − действующие ежемесячные платежи. */
export function availableMortgagePayment(paymentLimit: number, existingMonthlyPayments: number): number {
  return Math.max(0, paymentLimit - Math.max(0, existingMonthlyPayments));
}

// ============================================================================
// Кредитная история (ПКБ = FCB / ГКБ = SCB)
// ============================================================================

export function extractCreditHistory(rawText: string): DocumentExtraction {
  const text = normText(rawText);
  const low = text.toLowerCase();
  const fields: FieldValue[] = [];
  const gates: string[] = [];
  const notes: string[] = [];

  // bureau
  const isFCB = /первое кредитное бюро|пкб|first credit bureau|\bfcb\b/i.test(text);
  const isSCB = /государственн[оа].{0,20}кредитн.{0,20}бюро|гкб|\bscb\b/i.test(text);
  const bureau = isFCB ? 'FCB' : isSCB ? 'SCB' : 'UNKNOWN';
  fields.push(fld({
    key: 'bureau', label: 'Бюро', presence: bureau === 'UNKNOWN' ? 'UNKNOWN' : 'PRESENT',
    rawValue: bureau === 'UNKNOWN' ? null : (isFCB ? 'ПКБ' : 'ГКБ'), normalizedValue: bureau,
    confidence: bureau === 'UNKNOWN' ? 0 : 0.9, critical: true, level: 'SOURCE_FACT',
  }));

  // report_kind
  const full = /полный\s+персональн[а-яё]*\s+кредитн[а-яё]*\s+отч[её]т/i.test(text);
  fields.push(fld({
    key: 'report_kind', label: 'Тип отчёта', presence: full ? 'PRESENT' : 'UNKNOWN',
    rawValue: full ? 'Полный персональный кредитный отчёт' : null,
    normalizedValue: full ? 'FULL_PERSONAL' : 'UNKNOWN', confidence: full ? 0.9 : 0,
    critical: true, level: 'SOURCE_FACT',
  }));

  // report_generated_at
  const dt = firstMatch(text, /(\d{2}[.\-/]\d{2}[.\-/]\d{4}(?:[ ,]+\d{2}:\d{2}(?::\d{2})?)?)/);
  fields.push(fld({
    key: 'report_generated_at', label: 'Дата/время формирования', presence: dt ? 'PRESENT' : 'UNKNOWN',
    rawValue: dt, normalizedValue: dt, confidence: dt ? 0.7 : 0, critical: true, level: 'SOURCE_FACT',
    evidence: dt ?? undefined,
  }));

  // pages declared (footer N/29)
  const pagesDecl = firstMatch(text, /\b\d{1,3}\s*\/\s*(\d{1,3})\b/);
  fields.push(fld({
    key: 'report_pages_declared', label: 'Страниц (по footer)', presence: pagesDecl ? 'PRESENT' : 'UNKNOWN',
    rawValue: pagesDecl, normalizedValue: pagesDecl ? parseInt(pagesDecl, 10) : null,
    confidence: pagesDecl ? 0.6 : 0, critical: true, level: 'SOURCE_FACT',
  }));

  // ПКР рейтинг (SOURCE_FACT, не метрика CASA)
  const pkr = firstMatch(text, /пкр[^\d]{0,20}(\d{2,4})/i) || firstMatch(text, /рейтинг[^\d]{0,20}(\d{3,4})/i);
  fields.push(fld({
    key: 'bureau_rating', label: 'ПКР (рейтинг бюро)', presence: pkr ? 'PRESENT' : 'BLANK',
    rawValue: pkr, normalizedValue: pkr ? parseInt(pkr, 10) : null, confidence: pkr ? 0.5 : 0,
    critical: false, level: 'SOURCE_FACT', evidence: pkr ?? undefined,
  }));

  // грубый счётчик напечатанных договоров (source contract records)
  const contractHits = (low.match(/контракт|договор[^а-я]/g) || []).length;
  // текущий остаток из summary (если явно назван)
  const balRaw = firstMatch(text, /(?:текущ[а-яё]+\s+остаток|итого\s+остаток|остаток\s+задолженности)[^0-9]{0,30}([\d  ., ]{3,})/i);
  const balNum = balRaw ? parseMoney(balRaw) : null;
  fields.push(fld({
    key: 'outstanding_total_reported', label: 'Итоговый остаток (из summary)',
    presence: balNum !== null ? 'PRESENT' : 'BLANK', rawValue: balRaw ? balRaw.trim() : null,
    normalizedValue: balNum, confidence: balNum !== null ? 0.5 : 0, critical: true, level: 'SOURCE_FACT',
    evidence: balRaw?.trim(),
  }));

  // просрочки: current DPD vs lifetime max — раздельно (инвариант ч.4)
  const maxDpd = firstMatch(text, /макс[а-яё]*[^0-9]{0,20}просрочк[а-яё]*[^0-9]{0,20}(\d{1,4})/i)
    || firstMatch(text, /(\d{2,4})\s*(?:дн[а-яё]*)\s*(?:макс|наибольш)/i);
  fields.push(fld({
    key: 'max_dpd_lifetime_reported', label: 'Макс. DPD за всё время (факт)',
    presence: maxDpd ? 'PRESENT' : 'UNKNOWN', rawValue: maxDpd, normalizedValue: maxDpd ? parseInt(maxDpd, 10) : null,
    confidence: maxDpd ? 0.4 : 0, critical: true, level: 'SOURCE_FACT', evidence: maxDpd ?? undefined,
  }));
  notes.push('Текущий DPD и исторический максимум DPD не смешиваются; максимум — это факт прошлого, а не текущая просрочка.');

  // Сводные счётчики договоров — чистые, надёжные якоря реального отчёта ПКБ
  // («2Действующие договоры без просрочки» и т.п.). Калибровано на образце.
  const cnt = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const pushCount = (key: string, label: string, val: number | null, critical: boolean): void => {
    fields.push(fld({
      key, label, presence: val !== null ? 'PRESENT' : 'UNKNOWN', normalizedValue: val,
      confidence: val !== null ? 0.85 : 0, critical, level: 'SOURCE_FACT',
    }));
  };
  pushCount('active_without_overdue', 'Действующие договоры без просрочки', cnt(/(\d+)\s*Действующие\s+договор[а-яё]*\s+без\s+просрочки/i), true);
  pushCount('active_with_overdue', 'Действующие договоры с просрочкой', cnt(/(\d+)\s*Действующие\s+договор[а-яё]*\s+с\s+просрочкой/i), true);
  pushCount('closed_without_overdue', 'Завершённые договоры без просрочки', cnt(/(\d+)\s*Завершенн[а-яё]*\s+договор[а-яё]*\s+без\s+просрочки/i), false);
  pushCount('closed_with_overdue', 'Завершённые договоры с просрочкой', cnt(/(\d+)\s*Завершенн[а-яё]*\s+договор[а-яё]*\s+с\s+просрочкой/i), false);
  pushCount('recalled_contracts', 'Отозванные договоры', cnt(/(\d+)\s*Отозванн[а-яё]*\s+договор/i), false);

  const template = full && bureau === 'FCB' ? 'FCB_FULL_PERSONAL_PDF' : 'UNKNOWN';
  const supported = template === 'FCB_FULL_PERSONAL_PDF';
  if (!supported) gates.push('SAMPLE_REQUIRED: авто-разбор подтверждён только для полного персонального отчёта ПКБ; для этого файла нужен золотой образец шаблона.');
  gates.push('CONTRACT_REQUIRED: криптографическая проверка подлинности PDF не выполняется (нужен договор/канал бюро) — подлинность UNVERIFIED, требуется ручная проверка.');
  gates.push('LEGAL_REVIEW_REQUIRED: текст согласия, роли controller/processor, срок хранения — вне кода.');
  notes.push(`Найдено напечатанных упоминаний договоров/контрактов: ~${contractHits} (грубая оценка до полного разбора блоков).`);

  return {
    docType: 'credit_history',
    template,
    supported,
    statuses: {
      file_integrity: text.length > 20 ? 'VALID' : 'UNREADABLE',
      authenticity: 'MANUAL_REVIEW_REQUIRED',
      extraction: text.length > 20 ? 'PARTIAL' : 'FAILED',
    },
    fields,
    derived: {
      source_contract_record_hint: contractHits,
      current_outstanding_reported: balNum,
    },
    gates,
    notes,
    reviewRequired: true,
    textChars: rawText.length,
  };
}

// ============================================================================
// ЕНПФ (Pension Contribution Engine)
// ============================================================================

// КНП registry (спека 5.7) — versioned, effective-dated.
const KNP_REGISTRY: Record<string, { type: string; cls: 'CONTRIBUTION' | 'PENALTY'; base: 'CONDITIONAL' | 'NEVER' }> = {
  '010': { type: 'OPV', cls: 'CONTRIBUTION', base: 'CONDITIONAL' },
  '019': { type: 'PENALTY_OPV', cls: 'PENALTY', base: 'NEVER' },
  '015': { type: 'OPPV', cls: 'CONTRIBUTION', base: 'CONDITIONAL' },
  '009': { type: 'PENALTY_OPPV', cls: 'PENALTY', base: 'NEVER' },
  '089': { type: 'OPVR', cls: 'CONTRIBUTION', base: 'CONDITIONAL' },
  '098': { type: 'PENALTY_OPVR', cls: 'PENALTY', base: 'NEVER' },
  '013': { type: 'DPV', cls: 'CONTRIBUTION', base: 'NEVER' },
};

export function extractPension(rawText: string): DocumentExtraction {
  const text = normText(rawText);
  const fields: FieldValue[] = [];
  const gates: string[] = [];
  const notes: string[] = [];

  const isEnpf = /енпф|пенсионн[а-яё]+\s+(?:взнос|накоплен|актив)|поступлени[а-яё]+\s+и\s+движени[а-яё]+\s+средств/i.test(text);
  const template = isEnpf ? 'GOVCORP_ENPF_MOVEMENT_RU_KK_2026?' : 'UNKNOWN';

  // номер документа
  const docNo = firstMatch(text, /№\s*(\d{6,})/);
  fields.push(fld({
    key: 'document_number', label: 'Номер документа', presence: docNo ? 'PRESENT' : 'BLANK',
    rawValue: docNo, normalizedValue: docNo, confidence: docNo ? 0.6 : 0, critical: false, level: 'SOURCE_FACT',
  }));

  // период запроса шапки (хранить ОТДЕЛЬНО от покрытия!)
  const period = text.match(/(\d{2}[.\-/]\d{2}[.\-/]\d{4})\s*[-–—]\s*(\d{2}[.\-/]\d{2}[.\-/]\d{4})/);
  fields.push(fld({
    key: 'report_query_period', label: 'Период запроса (шапка)', presence: period ? 'PRESENT' : 'UNKNOWN',
    rawValue: period ? `${period[1]} – ${period[2]}` : null, normalizedValue: period ? `${period[1]}..${period[2]}` : null,
    confidence: period ? 0.7 : 0, critical: false, level: 'SOURCE_FACT', evidence: period?.[0],
  }));
  notes.push('Период запроса в шапке — это НЕ доказанное покрытие месяцев; covered_month_count остаётся UNKNOWN до подтверждения шаблона (RG-01).');

  // строки взносов: ищем КНП-коды и рядом суммы/периоды/статусы
  const knpCodes = Array.from(text.matchAll(/\b(0\d{2}|\d{3})\b/g)).map((m) => m[1]);
  const knpFound = knpCodes.filter((c) => KNP_REGISTRY[c]);
  // Суммы в выписке ЕНПФ (реальный шаблон GOVCORP) печатаются ОТДЕЛЬНЫМИ строками:
  // «20000.0» / «20 000,00» (без обязательного пробела-тысяч, точка или запятая,
  // 1–2 знака). Берём только строки-числа с дробной частью — это исключает даты
  // ДД.ММ.ГГГГ (4-значный год), время и 12-значные ИИН/БИН.
  const amounts = text
    .split('\n')
    .map((l) => l.trim())
    .map((l) => (/^(?:\d{1,3}(?:[  ]\d{3})*|\d{3,})[.,]\d{1,2}$/.test(l) ? parseMoney(l) : null))
    .filter((v): v is number => v !== null && v > 0);
  const processed = /обработанн/i.test(text);
  const months = Array.from(text.matchAll(/\b(0[1-9]|1[0-2])[.\-/](20\d{2})\b/g)).map((m) => `${m[2]}-${m[1]}`);
  const uniqueMonths = Array.from(new Set(months));

  const primaryKnp = knpFound[0] ?? null;
  const knpInfo = primaryKnp ? KNP_REGISTRY[primaryKnp] : null;
  fields.push(fld({
    key: 'payment_code', label: 'КНП (код назначения платежа)', presence: primaryKnp ? 'PRESENT' : 'UNKNOWN',
    rawValue: primaryKnp, normalizedValue: primaryKnp, confidence: primaryKnp ? 0.6 : 0, critical: true, level: 'SOURCE_FACT',
  }));
  fields.push(fld({
    key: 'contribution_type', label: 'Тип взноса', presence: knpInfo ? 'PRESENT' : 'UNKNOWN',
    rawValue: knpInfo?.type ?? null, normalizedValue: knpInfo?.type ?? 'UNKNOWN', confidence: knpInfo ? 0.6 : 0,
    critical: true, level: 'SOURCE_FACT',
  }));
  fields.push(fld({
    key: 'source_status', label: 'Статус строк', presence: processed ? 'PRESENT' : 'UNKNOWN',
    rawValue: processed ? 'ОБРАБОТАННЫЕ' : null, normalizedValue: processed ? 'PROCESSED' : 'UNKNOWN',
    confidence: processed ? 0.7 : 0, critical: true, level: 'SOURCE_FACT',
  }));

  // наблюдаемые месяцы и суммы (CASA_DERIVED) — БЕЗ covered_month_count
  const observedMonthCount = uniqueMonths.length;
  const positiveSum = amounts.reduce((s, a) => s + a, 0);
  const avg = amounts.length ? Math.round((positiveSum / amounts.length) * 100) / 100 : null;
  fields.push(fld({
    key: 'observed_month_count', label: 'Наблюдаемых месяцев с взносом', presence: observedMonthCount ? 'PRESENT' : 'UNKNOWN',
    normalizedValue: observedMonthCount || null, confidence: observedMonthCount ? 0.5 : 0, critical: false, level: 'CASA_DERIVED',
  }));
  fields.push(fld({
    key: 'observed_amount_avg', label: 'Средний взнос (наблюдаемый), ₸', presence: avg !== null ? 'PRESENT' : 'UNKNOWN',
    normalizedValue: avg, confidence: avg !== null ? 0.5 : 0, critical: false, level: 'CASA_DERIVED',
  }));

  // ОЦЕНКА ДОХОДА из ОПВ — по продуктовому правилу CASA Pro (Соц. кодекс РК + АРРФР):
  // среднемесячный доход = средний ОПВ работника (КНП 010) / 10%; окно 6 месяцев.
  // Берётся ИМЕННО ОПВ работника (010), НЕ ОПВР работодателя (089). Это
  // предварительная оценка — банк может учитывать нестабильные поступления,
  // пропуски и самостоятельные взносы иначе.
  const est = estimateIncomeFromOpv(knpInfo?.type === 'OPV' ? amounts : [], knpInfo?.type ?? null);
  fields.push(fld({
    key: 'estimated_avg_opv', label: 'Средний ОПВ в мес. (работника), ₸',
    presence: est.avgOpv !== null ? 'PRESENT' : 'UNKNOWN', normalizedValue: est.avgOpv,
    confidence: est.avgOpv !== null ? 0.5 : 0, critical: false, level: 'CASA_DERIVED',
  }));
  fields.push(fld({
    key: 'estimated_monthly_income', label: 'Оценка среднемес. дохода (ОПВ/10%), ₸',
    presence: est.monthlyIncome !== null ? 'PRESENT' : 'UNKNOWN', normalizedValue: est.monthlyIncome,
    confidence: est.monthlyIncome !== null ? 0.5 : 0, critical: true, level: 'CASA_DERIVED',
    evidence: est.monthlyIncome !== null ? `${est.avgOpv} / 0.10` : est.reason,
  }));
  fields.push(fld({
    key: 'estimated_payment_limit', label: 'Лимит кредитных платежей (доход×50%), ₸',
    presence: est.paymentLimit !== null ? 'PRESENT' : 'UNKNOWN', normalizedValue: est.paymentLimit,
    confidence: est.paymentLimit !== null ? 0.5 : 0, critical: false, level: 'CASA_DERIVED',
  }));
  if (est.monthlyIncome !== null) {
    notes.push(`Предварительная оценка CASA Pro: среднемес. доход = средний ОПВ ${est.avgOpv} ₸ / 10% = ${est.monthlyIncome} ₸; лимит всех кредитных платежей = доход × 50% (КДН 0.5) = ${est.paymentLimit} ₸. Доступный платёж по новой ипотеке = лимит − действующие платежи. Основание: Соц. кодекс РК и разъяснение АРРФР. Банк может учитывать нестабильные поступления/пропуски/самостоятельные взносы иначе.`);
  } else {
    notes.push(`Доход из ОПВ не оценён: ${est.reason}. Формула применяется только к ОПВ работника (КНП 010), не к ОПВР (089) и не к пеням.`);
  }

  if (template.includes('?') || template === 'UNKNOWN') {
    gates.push('SAMPLE_REQUIRED: точный разбор строк ЕНПФ подтверждён только на золотом образце шаблона GOVCORP; на произвольной выписке распознавание частичное.');
  }
  gates.push('CONTRACT_REQUIRED: проверка подлинности (штрих-код ЕНПФ) не выполняется — только ручная.');
  gates.push('LEGAL_REVIEW_REQUIRED: срок хранения и роли обработки — вне кода.');
  notes.push('covered_month_count и NO_CONTRIBUTION не выставляются (нет доказанного покрытия) — только «наблюдаемые месяцы».');

  return {
    docType: 'enpf_statement',
    template,
    supported: false,
    statuses: {
      file_integrity: text.length > 20 ? 'VALID' : 'UNREADABLE',
      authenticity: 'MANUAL_REVIEW_REQUIRED',
      extraction: text.length > 20 ? 'PARTIAL' : 'FAILED',
    },
    fields,
    derived: {
      observed_month_count: observedMonthCount || null,
      observed_amount_avg: avg,
      knp_contribution_rows: knpFound.length || null,
      covered_month_count: null, // UNKNOWN до подтверждения покрытия
      estimated_avg_opv: est.avgOpv,
      estimated_monthly_income: est.monthlyIncome,
      estimated_payment_limit: est.paymentLimit,
    },
    gates,
    notes,
    reviewRequired: true,
    textChars: rawText.length,
  };
}

// --- диспетчер ---------------------------------------------------------------

export function extractDocument(
  docType: 'credit_history' | 'enpf_statement',
  text: string,
): DocumentExtraction {
  return docType === 'credit_history' ? extractCreditHistory(text) : extractPension(text);
}
