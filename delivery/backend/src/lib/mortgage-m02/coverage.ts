/**
 * M02 R0 — coverage engine и freshness.
 *
 * Источник: M02 §9 (batch и coverage, таблица overall_status), §13 (freshness).
 *
 * Главный запрет спеки и главная причина, по которой этот модуль существует
 * отдельно: частичная проверка НЕ должна выглядеть как чистый клиент.
 * COMPLETE_NO_RECORDS закрыт строгим proof guard — любой manual, unavailable,
 * unknown, error, blocked или stale исключает его.
 *
 * Overall выводится детерминированно из результатов. Пользователь не выбирает
 * общий исход руками (§9).
 */

import { isProvenNegative, type CheckOutcome, type CheckStatus } from './not-found-mapper';

export type OverallStatus =
  | 'COMPLETE_FACTS_FOUND'
  | 'COMPLETE_NO_RECORDS'
  | 'PARTIAL'
  | 'BLOCKED_CONSENT'
  | 'BLOCKED_LEGAL'
  | 'STALE';

export interface CoverageInputResult {
  checkType: string;
  /** Входит ли проверка в знаменатель замороженного манифеста. */
  required: boolean;
  status: CheckStatus;
  outcome: CheckOutcome;
  /** Есть ли пригодное evidence. Без него result не считается completed (§9). */
  evidenceValid: boolean;
  /** Просрочен ли результат относительно fresh_until. */
  stale: boolean;
}

export interface CoverageCounts {
  requiredTotal: number;
  completed: number;
  provenNegative: number;
  found: number;
  manual: number;
  unavailable: number;
  blocked: number;
  stale: number;
  unknown: number;
  error: number;
}

export interface CoverageSummary extends CoverageCounts {
  overallStatus: OverallStatus;
  /** Готовый текст брокеру (§9). Технические enum'ы — в деталях. */
  brokerText: string;
}

export interface CoverageContext {
  /** Согласие отсутствует/истекло/отозвано/не та цель. */
  consentBlocked?: boolean;
  /** Не выполнен обязательный legal gate для планируемого маршрута. */
  legalBlocked?: boolean;
}

/**
 * Считается ли результат завершённым для покрытия.
 *
 * §9: «Только terminal, fresh, evidence-valid per-source result с допустимым
 * outcome». UNKNOWN допустимым исходом не является — источник не дал ответа.
 */
function countsAsCompleted(r: CoverageInputResult): boolean {
  if (r.status !== 'COMPLETED') return false;
  if (r.stale) return false;
  if (!r.evidenceValid) return false;
  return r.outcome === 'FOUND' || r.outcome === 'NOT_FOUND'
    || r.outcome === 'ZERO' || r.outcome === 'NOT_APPLICABLE';
}

export function computeCoverage(
  requiredTotal: number,
  results: readonly CoverageInputResult[],
  context: CoverageContext = {},
): CoverageSummary {
  const required = results.filter((r) => r.required);

  const counts: CoverageCounts = {
    requiredTotal,
    completed: 0,
    provenNegative: 0,
    found: 0,
    manual: 0,
    unavailable: 0,
    blocked: 0,
    stale: 0,
    unknown: 0,
    error: 0,
  };

  for (const r of required) {
    if (r.stale) counts.stale += 1;

    if (countsAsCompleted(r)) {
      counts.completed += 1;
      if (r.outcome === 'FOUND') counts.found += 1;
      if (isProvenNegative(r.status, r.outcome)) counts.provenNegative += 1;
      continue;
    }

    // Каждая из этих категорий отдельно исключает COMPLETE_NO_RECORDS (§9).
    if (r.status === 'MANUAL_REQUIRED') counts.manual += 1;
    else if (r.status === 'UNAVAILABLE') counts.unavailable += 1;
    else if (r.status === 'BLOCKED') counts.blocked += 1;
    else if (r.status === 'ERROR') counts.error += 1;
    else if (r.status === 'COMPLETED' && r.outcome === 'UNKNOWN') counts.unknown += 1;
    else if (r.status === 'COMPLETED' && !r.evidenceValid) counts.error += 1;
  }

  const overallStatus = deriveOverallStatus(requiredTotal, counts, context);
  return { ...counts, overallStatus, brokerText: brokerTextFor(overallStatus, counts) };
}

/**
 * Приоритет итога (§9 «ПРИОРИТЕТ ИТОГА»):
 *  1. consent block показывается до запуска;
 *  2. legal block;
 *  3. stale обязательного результата делает batch STALE;
 *  4. любой незавершённый/unknown/error делает покрытие неполным → PARTIAL;
 *  5. COMPLETE_* допускается только при полном доказанном покрытии.
 */
function deriveOverallStatus(
  requiredTotal: number,
  c: CoverageCounts,
  context: CoverageContext,
): OverallStatus {
  if (context.consentBlocked) return 'BLOCKED_CONSENT';
  if (context.legalBlocked) return 'BLOCKED_LEGAL';
  if (c.stale > 0) return 'STALE';

  const fullyCovered = requiredTotal > 0 && c.completed === requiredTotal;
  if (!fullyCovered) return 'PARTIAL';

  // Полное покрытие. Найденный факт важнее «нет записей».
  if (c.found > 0) return 'COMPLETE_FACTS_FOUND';

  // Строгий proof guard: каждый обязательный результат обязан быть ДОКАЗАННЫМ
  // negative. Без этого «записей не найдено» — ложное утверждение.
  if (c.provenNegative === requiredTotal
    && c.manual === 0 && c.unavailable === 0 && c.blocked === 0
    && c.unknown === 0 && c.error === 0) {
    return 'COMPLETE_NO_RECORDS';
  }

  return 'PARTIAL';
}

function brokerTextFor(overall: OverallStatus, c: CoverageCounts): string {
  switch (overall) {
    case 'COMPLETE_FACTS_FOUND':
      return `Проверка завершена. Найдены факты: ${c.found}. Это не решение банка.`;
    case 'COMPLETE_NO_RECORDS':
      return 'Обязательные источники проверены. По проверенным источникам записей не найдено.';
    case 'PARTIAL':
      return `Проверка частичная: ${c.completed} из ${c.requiredTotal}. Нельзя делать вывод об отсутствии записей.`;
    case 'BLOCKED_CONSENT':
      return 'Нужно согласие клиента. Внешние запросы не выполнялись.';
    case 'BLOCKED_LEGAL':
      return 'Автоматическая проверка пока недоступна. Используйте разрешённый ручной путь.';
    case 'STALE':
      return 'Результат устарел. Обновите проверку.';
    default:
      return 'Проверка частичная.';
  }
}

// --- Freshness (§13) --------------------------------------------------------

export interface FreshnessView {
  checkedAt: string | null;
  sourceDataAsOf: string | null;
  freshUntil: string | null;
  stale: boolean;
  /** Человеческий возраст; не заменяет даты (§13). */
  ageText: string;
  /** Текст, когда источник не заявил дату актуальности. */
  sourceDataAsOfText: string;
}

/**
 * Три РАЗНЫЕ временные характеристики (§13). Их нельзя схлопывать в одну:
 * checked_at — когда проверил оператор; source_data_as_of — на какую дату
 * актуальны данные источника; fresh_until — внутренняя policy TTL, которая не
 * выдаётся за официальный срок документа.
 */
export function buildFreshness(input: {
  checkedAt: Date | null | undefined;
  sourceDataAsOf: Date | null | undefined;
  freshUntil: Date | null | undefined;
  now: Date;
}): FreshnessView {
  // undefined и null здесь означают одно и то же — «неизвестно». Различать их
  // нельзя: любая попытка «догадаться» о дате нарушает §13.
  const checkedAt = input.checkedAt ?? null;
  const sourceDataAsOf = input.sourceDataAsOf ?? null;
  const freshUntil = input.freshUntil ?? null;
  const { now } = input;
  const stale = freshUntil !== null && freshUntil.getTime() <= now.getTime();

  let ageText = 'Дата проверки неизвестна';
  if (checkedAt) {
    const days = Math.floor((now.getTime() - checkedAt.getTime()) / (24 * 60 * 60 * 1000));
    ageText = days <= 0 ? 'Проверено сегодня' : `Проверено ${days} дн. назад`;
  }

  return {
    checkedAt: checkedAt ? checkedAt.toISOString() : null,
    sourceDataAsOf: sourceDataAsOf ? sourceDataAsOf.toISOString() : null,
    freshUntil: freshUntil ? freshUntil.toISOString() : null,
    stale,
    ageText,
    sourceDataAsOfText: sourceDataAsOf
      ? sourceDataAsOf.toISOString()
      : 'Источник не указал дату актуальности',
  };
}

/** fresh_until из TTL реестра. TTL=null → UNKNOWN, а не «свежо навсегда». */
export function computeFreshUntil(checkedAt: Date, ttlSeconds: number | null): Date | null {
  if (ttlSeconds === null) return null;
  return new Date(checkedAt.getTime() + ttlSeconds * 1000);
}
