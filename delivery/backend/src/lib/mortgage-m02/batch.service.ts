/**
 * M02 R0 — сборка batch: гейты §7 → результаты по frozen manifest → coverage.
 *
 * Чистая логика без БД: принимает уже загруженный контекст и решает, что должно
 * быть создано. Так гейты можно проверить тестами без поднятия базы, а маршрут
 * остаётся тонким.
 *
 * Порядок гейтов из §7 значим: IIN_FORMAT → IIN_CHECK_DIGIT → IDENTITY_BINDING →
 * CONSENT → SOURCE_GATE. Нарушение любого из первых четырёх означает НОЛЬ
 * внешних обращений и batch с блокером, а не «попробуем что получится».
 */

import { validateIin, maskIin } from './iin';
import {
  freezeManifestV1,
  getSource,
  isConnectorAllowed,
  M02_CONSENT_PURPOSE,
  type FrozenManifest,
  type RegisteredSource,
} from './source-registry';
import {
  normalizeObservation,
  humanMessage,
  type CheckOutcome,
  type CheckStatus,
  type ErrorCategory,
  type Observation,
} from './not-found-mapper';
import {
  computeCoverage,
  computeFreshUntil,
  type CoverageInputResult,
  type CoverageSummary,
} from './coverage';

export type BatchBlockerCode =
  | 'IIN_FORMAT'
  | 'IIN_CHECK_DIGIT'
  | 'IDENTITY_BINDING'
  | 'BLOCKED_CONSENT'
  | 'BLOCKED_LEGAL';

/** Согласие участника в том виде, в каком его отдаёт M01. */
export interface ConsentView {
  id: string;
  purposeCode: string;
  status: string;
  grantedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface BatchGateContext {
  iin: string | null;
  /** true только для refresh: субъект уже привязан прошлым batch. */
  subjectAlreadyBound?: boolean;
  identityVersion: number | null;
  /** Согласие ИМЕННО этого участника: чужое согласие не покрывает (§7). */
  consent: ConsentView | null;
  now: Date;
}

export interface GateDecision {
  allowed: boolean;
  blockerCode: BatchBlockerCode | null;
  message: string | null;
}

/**
 * Проверяет гейты до маршрута. Возвращает первое нарушение — дальше идти нельзя,
 * и внешних вызовов не будет ни одного.
 */
export function evaluateGates(ctx: BatchGateContext): GateDecision {
  // При обновлении существующей проверки ИИН не предъявляется заново: он не
  // хранится, а привязка субъекта унаследована от исходного batch. Пропускаем
  // именно этот гейт ЯВНО — молча трактовать отсутствие ИИН как валидный вход
  // нельзя, это скрыло бы настоящую ошибку ввода в обычном создании.
  if (!ctx.subjectAlreadyBound) {
    const iinCheck = validateIin(ctx.iin);
    if (!iinCheck.valid) {
      return { allowed: false, blockerCode: iinCheck.code!, message: iinCheck.message };
    }
  }

  if (ctx.identityVersion === null || ctx.identityVersion < 1) {
    return {
      allowed: false,
      blockerCode: 'IDENTITY_BINDING',
      message: 'Личность участника не привязана к версии идентификации.',
    };
  }

  const consentDecision = evaluateConsent(ctx.consent, ctx.now);
  if (!consentDecision.allowed) return consentDecision;

  return { allowed: true, blockerCode: null, message: null };
}

/**
 * Согласие должно быть активным И относиться ровно к цели M02. Согласие на
 * другую цель (например, общий mortgage_prescore) маршрут не открывает (§7).
 */
export function evaluateConsent(consent: ConsentView | null, now: Date): GateDecision {
  const blocked = (message: string): GateDecision => ({
    allowed: false, blockerCode: 'BLOCKED_CONSENT', message,
  });

  if (!consent) return blocked('Нужно согласие клиента. Внешние запросы не выполнялись.');
  if (consent.purposeCode !== M02_CONSENT_PURPOSE) {
    return blocked('Согласие выдано на другую цель. Внешние запросы не выполнялись.');
  }
  if (consent.status !== 'ACTIVE' && consent.status !== 'GRANTED') {
    return blocked('Согласие не активно. Внешние запросы не выполнялись.');
  }
  if (consent.revokedAt !== null) {
    return blocked('Согласие отозвано. Внешние запросы не выполнялись.');
  }
  if (consent.expiresAt !== null && consent.expiresAt.getTime() <= now.getTime()) {
    return blocked('Срок действия согласия истёк. Внешние запросы не выполнялись.');
  }
  if (consent.grantedAt === null) {
    return blocked('Согласие ещё не подтверждено. Внешние запросы не выполнялись.');
  }
  return { allowed: true, blockerCode: null, message: null };
}

/** Плановая запись результата — то, что маршрут создаст в БД. */
export interface PlannedResult {
  sourceCode: string;
  sourceOwner: string;
  sourceUrl: string;
  checkType: string;
  automationMode: string;
  required: boolean;
  status: CheckStatus;
  outcome: CheckOutcome;
  errorCategory: ErrorCategory;
  retryable: boolean;
  reason: string;
  upstreamCode: string | null;
  checkedAt: Date | null;
  sourceDataAsOf: Date | null;
  freshUntil: Date | null;
  evidenceRef: string | null;
  legalBasisStatus: string;
  /** Нужно ли завести ручную задачу для этой проверки. */
  needsManualTask: boolean;
  instruction: string;
  humanText: string;
}

/**
 * Начальное наблюдение для источника в R0.
 *
 * Ни один источник не вызывается автоматически: коннекторы выключены. Поэтому
 * стартовое состояние определяется РЕЖИМОМ источника, а не попыткой запроса.
 */
function initialObservation(source: RegisteredSource): Observation {
  if (source.sourceClass === 'PROHIBITED') return { kind: 'PROHIBITED' };
  if (source.legalStatus === 'REJECTED') return { kind: 'PROHIBITED' };

  // Если бы коннектор был разрешён — здесь начинался бы вызов адаптера R1/R2.
  if (isConnectorAllowed(source)) return { kind: 'CONNECTOR_DISABLED' };

  switch (source.automationModeR0) {
    case 'MANUAL':
    case 'CLIENT_AUTHORIZED':
      return { kind: 'MANUAL_PENDING' };
    case 'UNAVAILABLE':
      return { kind: 'CONNECTOR_DISABLED' };
    default:
      return { kind: 'CONNECTOR_DISABLED' };
  }
}

function instructionFor(source: RegisteredSource): string {
  const captcha = source.captchaExpected
    ? ' Если сайт показывает CAPTCHA — пройдите её сами: автоматический обход запрещён.'
    : '';
  const client = source.automationModeR0 === 'CLIENT_AUTHORIZED'
    ? ' Документ получает сам клиент в своём личном кабинете; пароли, OTP и ЭЦП клиента не запрашивайте и не храните.'
    : '';
  return `Откройте официальный сервис (${source.owner}), выполните проверку «${source.checkType}»`
    + ' самостоятельно и зафиксируйте исход со ссылкой или скриншотом.'
    + `${captcha}${client}`;
}

/**
 * Планирует результаты по замороженному манифесту.
 *
 * Ничего не «пробует»: для каждого источника берётся его режим R0 и через
 * строгий маппер получается пара (status, outcome). Именно поэтому в R0 не
 * может случайно появиться NOT_FOUND.
 */
export function planResults(manifest: FrozenManifest, now: Date): PlannedResult[] {
  return manifest.entries.map((entry) => {
    const source = getSource(entry.sourceCode)!;
    const normalized = normalizeObservation(source.code, initialObservation(source));
    const needsManualTask = normalized.status === 'MANUAL_REQUIRED';

    return {
      sourceCode: source.code,
      sourceOwner: source.owner,
      sourceUrl: source.officialUrl,
      checkType: source.checkType,
      automationMode: source.automationModeR0,
      required: entry.required,
      status: normalized.status,
      outcome: normalized.outcome,
      errorCategory: normalized.errorCategory,
      retryable: normalized.retryable,
      reason: normalized.reason,
      upstreamCode: normalized.upstreamCode,
      // Проверка не выполнялась: дат нет, и подставлять «сейчас» нельзя —
      // это создало бы иллюзию свежего результата.
      checkedAt: null,
      sourceDataAsOf: null,
      freshUntil: null,
      evidenceRef: null,
      legalBasisStatus: source.legalStatus,
      needsManualTask,
      instruction: instructionFor(source),
      humanText: humanMessage(normalized.status, normalized.outcome, normalized.errorCategory, source),
    };
  });
}

export interface BuiltBatch {
  manifest: FrozenManifest;
  results: PlannedResult[];
  coverage: CoverageSummary;
  blockerCode: BatchBlockerCode | null;
  blockerMessage: string | null;
}

/**
 * Полная сборка batch: гейты → манифест → плановые результаты → coverage.
 *
 * При заблокированных гейтах результаты всё равно планируются (чтобы карточки
 * источников было видно), но ни одна проверка не выполняется, а overall
 * определяется блокером.
 */
export function buildBatch(ctx: BatchGateContext & {
  provenConditionalCheckTypes?: readonly string[];
}): BuiltBatch {
  const gate = evaluateGates(ctx);
  const manifest = freezeManifestV1({
    provenConditionalCheckTypes: ctx.provenConditionalCheckTypes,
  });
  const results = planResults(manifest, ctx.now);

  const coverageInput: CoverageInputResult[] = results.map((r) => ({
    checkType: r.checkType,
    required: r.required,
    status: r.status,
    outcome: r.outcome,
    evidenceValid: r.evidenceRef !== null,
    stale: false,
  }));

  const coverage = computeCoverage(manifest.requiredTotal, coverageInput, {
    consentBlocked: gate.blockerCode === 'BLOCKED_CONSENT',
    legalBlocked: gate.blockerCode === 'BLOCKED_LEGAL',
  });

  return {
    manifest,
    results,
    coverage,
    blockerCode: gate.blockerCode,
    blockerMessage: gate.message,
  };
}

/** Маска для ответа API — единственная форма ИИН, покидающая сервер. */
export function subjectView(iin: string | null): { iin_masked: string } {
  return { iin_masked: maskIin(iin) };
}

export { computeFreshUntil };
