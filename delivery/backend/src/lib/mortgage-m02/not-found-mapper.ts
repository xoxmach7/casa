/**
 * M02 R0 — строгий NOT_FOUND contract.
 *
 * Источник: M02 §12 (таблица «Наблюдение → Нормализация → Почему не NOT_FOUND»).
 *
 * Единственно допустимый NOT_FOUND (§12):
 *   status=completed И документированный no-match контракт конкретного источника
 *   И сохранённое evidence И свежий результат.
 *
 * Всё остальное — 403, 404, CAPTCHA, пустая страница, таймаут, отключённый
 * legal gate, дрейф схемы, null/«нет данных», незавершённая ручная задача —
 * НИКОГДА не превращается в «записей нет». Именно эта подмена делает частичную
 * проверку похожей на чистого клиента, и именно её запрещает §12.
 */

import { getSource, type RegisteredSource } from './source-registry';

/** Техническое состояние проверки. Отдельно от исхода (§10). */
export type CheckStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'MANUAL_REQUIRED'
  | 'BLOCKED'
  | 'UNAVAILABLE'
  | 'ERROR'
  | 'NOT_ALLOWED';

/** Бизнес-исход. UNKNOWN — самостоятельное значение, не 0 и не false (§12). */
export type CheckOutcome =
  | 'FOUND'
  | 'NOT_FOUND'
  | 'ZERO'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | null;

export type ErrorCategory =
  | 'ACCESS_REQUIRED'
  | 'ACCESS_DENIED'
  | 'MANUAL_REQUIRED'
  | 'SCHEMA_ERROR'
  | 'SOURCE_UNAVAILABLE'
  | 'LEGAL_UNCONFIRMED'
  | 'EVIDENCE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_ALLOWED'
  | null;

/** Что фактически наблюдалось. Имена — из левой колонки §12. */
export type Observation =
  | { kind: 'HTTP_STATUS'; status: number }
  | { kind: 'CAPTCHA' }
  | { kind: 'EMPTY_HTML' }
  | { kind: 'TIMEOUT' }
  | { kind: 'RATE_LIMIT' }
  | { kind: 'LEGAL_GATE_OFF' }
  | { kind: 'SCHEMA_DRIFT' }
  | { kind: 'EMPTY_VALUE' }
  | { kind: 'MANUAL_PENDING' }
  | { kind: 'MANUAL_WITHOUT_EVIDENCE' }
  | { kind: 'CONNECTOR_DISABLED' }
  | { kind: 'PROHIBITED' }
  /** Успешный ответ с документированным кодом no-match конкретного источника. */
  | { kind: 'DOCUMENTED_NO_MATCH'; upstreamCode: string; evidenceRef: string }
  /** Успешный ответ с найденной записью. */
  | { kind: 'DOCUMENTED_MATCH'; upstreamCode?: string; evidenceRef: string }
  /** Документированный нулевой/неприменимый исход (например, нулевая задолженность). */
  | { kind: 'DOCUMENTED_ZERO'; upstreamCode?: string; evidenceRef: string };

export interface NormalizedObservation {
  status: CheckStatus;
  outcome: CheckOutcome;
  errorCategory: ErrorCategory;
  /** Признак, что исход можно повторить автоматически (§21 retry). */
  retryable: boolean;
  /** Причина решения — идёт в аудит и в детали для админа. */
  reason: string;
  upstreamCode: string | null;
  evidenceRef: string | null;
}

function deny(
  status: CheckStatus,
  errorCategory: ErrorCategory,
  reason: string,
  retryable = false,
): NormalizedObservation {
  // Ключевой инвариант: исход НЕ выставляется. Отсутствие результата — это не
  // «ничего не найдено», это отсутствие проверки.
  return { status, outcome: null, errorCategory, retryable, reason, upstreamCode: null, evidenceRef: null };
}

/**
 * Нормализует наблюдение в пару (status, outcome).
 *
 * NOT_FOUND выдаётся только при DOCUMENTED_NO_MATCH И совпадении upstream-кода
 * с no-match контрактом источника И наличии evidence. Если у источника контракт
 * не определён (noMatchContract === null), доказанный negative невозможен в
 * принципе — возвращается UNKNOWN.
 */
export function normalizeObservation(
  sourceCode: string,
  observation: Observation,
): NormalizedObservation {
  const source = getSource(sourceCode);
  if (!source) {
    return deny('ERROR', 'SCHEMA_ERROR', `Источник ${sourceCode} отсутствует в реестре`);
  }

  switch (observation.kind) {
    case 'PROHIBITED':
      return deny('NOT_ALLOWED', 'NOT_ALLOWED', 'Проверка запрещена политикой CASA');

    case 'CONNECTOR_DISABLED':
      // R0: коннекторы выключены. Это не ошибка источника и не «нет записей».
      return deny('UNAVAILABLE', 'ACCESS_REQUIRED', 'Автоматический коннектор выключен (R0)');

    case 'LEGAL_GATE_OFF':
      return deny('BLOCKED', 'LEGAL_UNCONFIRMED', 'Правовой допуск не подтверждён; коннектор не запускался');

    case 'CAPTCHA':
      // CAPTCHA остаётся человеку: обход и OCR запрещены (§11).
      return deny('MANUAL_REQUIRED', 'MANUAL_REQUIRED', 'Источник требует CAPTCHA — проверка выполняется человеком');

    case 'MANUAL_PENDING':
      return deny('MANUAL_REQUIRED', 'MANUAL_REQUIRED', 'Ручная задача не выполнена');

    case 'MANUAL_WITHOUT_EVIDENCE':
      // «Записей нет» без доказательства запрещено (§11).
      return deny('ERROR', 'EVIDENCE_ERROR', 'Ручное подтверждение без evidence не принимается');

    case 'TIMEOUT':
    case 'RATE_LIMIT':
      return deny('UNAVAILABLE', 'SOURCE_UNAVAILABLE', 'Источник не дал успешного ответа', true);

    case 'EMPTY_HTML':
      return deny('ERROR', 'SCHEMA_ERROR', 'Пустой ответ без доказанного business outcome');

    case 'SCHEMA_DRIFT':
      // Неизвестная семантика ответа → карантин и разбор, а не догадка.
      return deny('ERROR', 'SCHEMA_ERROR', 'Дрейф схемы ответа: семантика не определена, результат в карантине');

    case 'EMPTY_VALUE':
      // null / «Нет данных» / пустой массив. UNKNOWN нельзя склеивать с 0/false.
      return {
        status: 'COMPLETED',
        outcome: 'UNKNOWN',
        errorCategory: null,
        retryable: false,
        reason: 'Источник вернул пустое значение, но его контракт не определяет это как no-match',
        upstreamCode: null,
        evidenceRef: null,
      };

    case 'HTTP_STATUS': {
      const { status } = observation;
      if (status === 404) {
        // HTTP 404 не означает отсутствие субъекта (§12).
        return deny('UNAVAILABLE', 'ACCESS_DENIED', 'HTTP 404 не означает отсутствие субъекта');
      }
      if (status === 403 || status === 401) {
        return deny('BLOCKED', 'ACCESS_REQUIRED', 'Источник не выдал клиентский результат: нет доступа');
      }
      if (status === 429) {
        return deny('UNAVAILABLE', 'SOURCE_UNAVAILABLE', 'Ограничение частоты запросов', true);
      }
      if (status >= 500) {
        return deny('UNAVAILABLE', 'SOURCE_UNAVAILABLE', `Источник вернул ${status}`, true);
      }
      return deny('ERROR', 'SCHEMA_ERROR', `Неинтерпретируемый HTTP ${status}`);
    }

    case 'DOCUMENTED_NO_MATCH': {
      if (!source.noMatchContract) {
        // У источника нет документированного контракта «нет записей» —
        // доказанный negative невозможен, каким бы ни был ответ.
        return {
          status: 'COMPLETED',
          outcome: 'UNKNOWN',
          errorCategory: null,
          retryable: false,
          reason: `Для источника ${source.code} контракт no-match не определён`,
          upstreamCode: observation.upstreamCode,
          evidenceRef: observation.evidenceRef,
        };
      }
      if (observation.upstreamCode !== source.noMatchContract) {
        return {
          status: 'COMPLETED',
          outcome: 'UNKNOWN',
          errorCategory: null,
          retryable: false,
          reason: `Код ${observation.upstreamCode} не совпадает с контрактом no-match ${source.noMatchContract}`,
          upstreamCode: observation.upstreamCode,
          evidenceRef: observation.evidenceRef,
        };
      }
      if (!observation.evidenceRef) {
        return deny('ERROR', 'EVIDENCE_ERROR', 'Доказанный negative требует evidence');
      }
      return {
        status: 'COMPLETED',
        outcome: 'NOT_FOUND',
        errorCategory: null,
        retryable: false,
        reason: `Документированный no-match ${observation.upstreamCode}`,
        upstreamCode: observation.upstreamCode,
        evidenceRef: observation.evidenceRef,
      };
    }

    case 'DOCUMENTED_MATCH':
      if (!observation.evidenceRef) {
        return deny('ERROR', 'EVIDENCE_ERROR', 'Найденный факт требует evidence');
      }
      return {
        status: 'COMPLETED',
        outcome: 'FOUND',
        errorCategory: null,
        retryable: false,
        reason: 'Документированное совпадение',
        upstreamCode: observation.upstreamCode ?? null,
        evidenceRef: observation.evidenceRef,
      };

    case 'DOCUMENTED_ZERO':
      if (!observation.evidenceRef) {
        return deny('ERROR', 'EVIDENCE_ERROR', 'Нулевой исход требует evidence');
      }
      return {
        status: 'COMPLETED',
        outcome: 'ZERO',
        errorCategory: null,
        retryable: false,
        reason: 'Документированный нулевой исход',
        upstreamCode: observation.upstreamCode ?? null,
        evidenceRef: observation.evidenceRef,
      };

    default: {
      const exhaustive: never = observation;
      return deny('ERROR', 'SCHEMA_ERROR', `Необработанное наблюдение ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Доказанный negative для покрытия (§9 proven_negative): completed + документированный
 * not_found/zero. Пустое, null и ошибочное сюда не попадают по построению.
 */
export function isProvenNegative(status: CheckStatus, outcome: CheckOutcome): boolean {
  return status === 'COMPLETED' && (outcome === 'NOT_FOUND' || outcome === 'ZERO');
}

/** Человеческий текст брокеру (§15). Технический enum — только в деталях/admin. */
export function humanMessage(
  status: CheckStatus,
  outcome: CheckOutcome,
  errorCategory: ErrorCategory,
  source?: RegisteredSource,
): string {
  const owner = source?.owner ?? 'официальный источник';
  if (status === 'QUEUED' || status === 'RUNNING') return 'Проверяем официальный источник…';
  if (status === 'NOT_ALLOWED') return 'Эта проверка не используется CASA.';
  if (status === 'MANUAL_REQUIRED') return 'Нужна ручная проверка на официальном сайте.';
  if (status === 'BLOCKED' && errorCategory === 'LEGAL_UNCONFIRMED') {
    return 'Автоматическая проверка пока недоступна: правовой допуск не подтверждён.';
  }
  if (status === 'BLOCKED' && errorCategory === 'ACCESS_REQUIRED') {
    return 'Автоматическая проверка пока не подключена.';
  }
  if (status === 'UNAVAILABLE') return 'Источник временно недоступен.';
  if (status === 'ERROR') return 'Результат не подтверждён.';
  if (status === 'COMPLETED') {
    if (outcome === 'FOUND') return 'Найдена запись. Это факт официального источника, а не решение банка.';
    if (outcome === 'NOT_FOUND') return `Записей не найдено в источнике: ${owner}.`;
    if (outcome === 'ZERO' || outcome === 'NOT_APPLICABLE') return `Проверено • ${owner}.`;
    if (outcome === 'UNKNOWN') return 'Источник не дал однозначного результата.';
  }
  return 'Проверка не завершена.';
}
