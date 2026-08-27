/**
 * M06 Calculation Engine — исполнение расчётного прогона поверх утверждённых
 * формул `m06-calc.ts` (CALC-F-001/002). Чистая логика: НЕ трогает БД и НЕ
 * принимает PDF (§21 «NO PDF») — только иммутабельные ссылки на снапшоты и
 * явные расчётные параметры.
 *
 * Канонизация и хэши — CASA-CJ-1 по M06 Production Spec v1.4 §29 (`casa-cj1.ts`).
 * Прогон обязан воспроизводить три golden-хэша FX-CALC-GOLDEN-001; это
 * проверяется `__tests__/m06-golden.test.ts` и является условием RG11.
 *
 * Единственный источник входных денег — опубликованный снапшот профиля M05
 * (§21 «client_profile_snapshot_id/hash: Required and immutable; sole profile
 * data source»). Ставка и срок — явные параметры прогона (§21 «parameters»).
 */

import { Prisma } from '@prisma/client';
import {
  requiredFinancing,
  annuityPaymentByParameters,
  type CalcResult,
  type InputStatus,
  type StatusedMoney,
} from './m06-calc';
import {
  computeCasaCjHashes,
  canonicalize,
  canonicalHash,
  sha256Hex,
  CASA_CJ_CANONICALIZATION_VERSION,
  type CanonicalValue,
  type ReplaySource,
} from './casa-cj1';

export { canonicalize, canonicalHash, sha256Hex };

/** §22/§29 envelope — точные строки замороженной спеки, не переименовывать. */
export const M06_SCHEMA_VERSION = 'casa.calculation_snapshot/1.0.0';
export const M06_ENGINE_VERSION = 'casa-calc-engine/1.0.0';
export const M06_FORMULA_REGISTRY_VERSION = 'm06-registry/1.0.0';
export const M06_DECIMAL_CONTEXT_VERSION = 'casa.decimal_context/p50-half-even__money-half-up/1.0.0';
export const M06_CANONICALIZATION_VERSION = CASA_CJ_CANONICALIZATION_VERSION;

/** Порядок массива значим для replay_hash — это порядок из §29. */
export const M06_FORMULA_VERSIONS = [
  'casa.required_financing/1.0.0',
  'casa.annuity_payment_by_parameters/1.0.0',
] as const;

const MoneyDecimal = Prisma.Decimal.clone({
  precision: 50,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN,
});

const MONEY_SCALE = 2;
const PERCENT_SCALE = 4;

/**
 * Каноническая десятичная строка (§29: «never binary floats»). null остаётся
 * null — «нет значения» никогда не превращается в «0.00».
 */
function decimalString(value: string | number | null | undefined, scale: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new MoneyDecimal(value);
  if (!d.isFinite()) return null;
  return d.toFixed(scale, Prisma.Decimal.ROUND_HALF_UP);
}

const CURRENCY = 'KZT';

/** Денежный вход прогона: значение + статус провенанса из M05. */
export interface StatusedAmount {
  amount: string | number | null;
  status: InputStatus;
}

export interface CalculationParameters {
  annualNominalRatePercent: string | number | null;
  termMonths: number | null;
  paymentFrequency?: 'MONTHLY';
}

export interface CalculationRunContext {
  caseId: string;
  /** §21: обязателен и иммутабелен — единственный источник данных профиля. */
  clientProfileSnapshot: { snapshotId: string; snapshotHash: string };
  /** §21: ссылки M02/M03/M04 ровно так, как их несёт M05. */
  selectedUpstreamRefs: {
    iin_check_batch_id: string | null;
    credit_history_snapshot_id: string | null;
    pension_snapshot_id: string | null;
  };
  targetPrice: StatusedAmount;
  availableNowDownPayment: StatusedAmount;
  parameters: CalculationParameters;
}

/** §22 Blockers: code + человеческая причина + ссылки на блокирующие входы. */
export interface CalculationBlocker extends Record<string, CanonicalValue> {
  code: string;
  reason: string;
  blocking_input_refs: string[];
  formula_id: string;
}

export interface CalculationResults {
  schemaVersion: string;
  engineVersion: string;
  decimalContextVersion: string;
  formulaRegistryVersion: string;
  canonicalizationVersion: string;
  requiredFinancing: CalcResult;
  annuity: CalcResult;
  status: CalcResult['status'];
  codes: string[];
  blockers: CalculationBlocker[];
}

export interface CalculationOutput {
  inputHash: string;
  outputHash: string;
  replayHash: string;
  canonicalizationVersion: string;
  /** Каноническая строка replay payload — evidence для RG11. */
  canonicalReplayPayload: string;
  /** Объект replay payload (allowlist §29) — сохраняется в снапшот. */
  replayPayload: Record<string, CanonicalValue>;
  canonicalInputs: CanonicalValue;
  canonicalOutputs: CanonicalValue;
  results: CalculationResults;
}

/** Свести статусы двух формул в один статус прогона (худший из значимых). */
function combineStatus(a: CalcResult, b: CalcResult): CalcResult['status'] {
  const order: CalcResult['status'][] = ['BLOCKED', 'INVALID_INPUT', 'COMPLETED_WITH_LIMITATIONS', 'COMPLETED'];
  for (const s of order) if (a.status === s || b.status === s) return s;
  return 'COMPLETED';
}

const BLOCKER_REASONS: Record<string, string> = {
  MISSING_INPUT: 'Обязательный вход отсутствует в снапшоте профиля',
  UNKNOWN_INPUT: 'Значение входа неизвестно (UNKNOWN ≠ 0)',
  STALE_INPUT: 'Значение входа устарело относительно выбранного снапшота',
  CONFLICTING_INPUT: 'По входу зафиксирован неразрешённый конфликт',
  NEGATIVE_AMOUNT: 'Отрицательная сумма недопустима',
  INVALID_TERM: 'Некорректный срок в месяцах',
  INVALID_RATE: 'Некорректная годовая номинальная ставка',
  UNSUPPORTED_FREQUENCY: 'Поддерживается только ежемесячная периодичность',
};

/** Разворачивает коды §19 в blocker'ы §22. Информационные коды не блокируют. */
function toBlockers(result: CalcResult): CalculationBlocker[] {
  if (result.status !== 'BLOCKED' && result.status !== 'INVALID_INPUT') return [];
  return result.codes.map((raw) => {
    const [code, ref] = raw.split(':');
    return {
      code,
      reason: BLOCKER_REASONS[code] ?? 'Расчёт заблокирован',
      blocking_input_refs: ref ? [ref] : [],
      formula_id: result.formulaId,
    };
  });
}

/**
 * Канонические inputs §29. Форма и имена полей — из golden-payload: изменение
 * любого ключа меняет input_hash, поэтому она фиксирована спекой, а не вкусом.
 */
function buildCanonicalInputs(ctx: CalculationRunContext): CanonicalValue {
  return {
    annuity_payment: {
      annual_nominal_rate_percent: decimalString(ctx.parameters.annualNominalRatePercent, PERCENT_SCALE),
      payment_frequency: ctx.parameters.paymentFrequency ?? 'MONTHLY',
      principal: {
        amount: null as string | null, // подставляется после CALC-F-001
        currency: CURRENCY,
        source_output_ref: 'casa.required_financing/1.0.0',
      },
      term_months: ctx.parameters.termMonths,
    },
    required_financing: {
      available_now_down_payment: {
        amount: decimalString(ctx.availableNowDownPayment.amount, MONEY_SCALE),
        currency: CURRENCY,
        source_metric_ref: 'available_now_total',
        status: ctx.availableNowDownPayment.status,
      },
      target_price: {
        amount: decimalString(ctx.targetPrice.amount, MONEY_SCALE),
        currency: CURRENCY,
        source_field_ref: 'purchase_goal.target_price_max',
        status: ctx.targetPrice.status,
      },
    },
  };
}

/** Канонические outputs §29: raw/persisted/display, null при блоке. */
function buildCanonicalOutputs(rf: CalcResult, ann: CalcResult): CanonicalValue {
  return {
    annuity_payment: {
      display: ann.displayKzt === null ? null : `${ann.displayKzt} ₸`,
      persisted: ann.value === null ? null : { amount: ann.value, currency: CURRENCY },
      raw: ann.raw,
      status: ann.status,
    },
    required_financing: {
      status: rf.status,
      value: rf.value === null ? null : { amount: rf.value, currency: CURRENCY },
    },
  };
}

/**
 * Исполнить прогон: required_financing = max(P − A, 0); затем аннуитет с
 * principal = required_financing. Если финансирование заблокировано — аннуитет
 * тоже блокируется (principal неизвестен), ноль не подставляется.
 */
export function runCalculation(ctx: CalculationRunContext): CalculationOutput {
  const rf = requiredFinancing({
    targetPrice: { value: ctx.targetPrice.amount, status: ctx.targetPrice.status },
    availableNowDownPayment: {
      value: ctx.availableNowDownPayment.amount,
      status: ctx.availableNowDownPayment.status,
    },
  });

  // Качество входа наследуется вниз по цепочке: аннуитет, посчитанный от
  // неподтверждённого финансирования, не может отчитаться как COMPLETED.
  const principal: StatusedMoney = rf.value !== null
    ? { value: rf.value, status: rf.status === 'COMPLETED_WITH_LIMITATIONS' ? 'DECLARED' : 'CONFIRMED' }
    : { status: 'UNKNOWN' };
  const ann = annuityPaymentByParameters({
    principal,
    annualNominalRatePercent: ctx.parameters.annualNominalRatePercent ?? null,
    termMonths: ctx.parameters.termMonths,
    paymentFrequency: ctx.parameters.paymentFrequency,
  });

  const canonicalInputs = buildCanonicalInputs(ctx) as Record<string, Record<string, CanonicalValue>>;
  // principal аннуитета — выход CALC-F-001, а не отдельный ввод оператора.
  (canonicalInputs.annuity_payment.principal as Record<string, CanonicalValue>).amount = rf.value;

  const canonicalOutputs = buildCanonicalOutputs(rf, ann);
  const blockers = [...toBlockers(rf), ...toBlockers(ann)];

  const results: CalculationResults = {
    schemaVersion: M06_SCHEMA_VERSION,
    engineVersion: M06_ENGINE_VERSION,
    decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
    formulaRegistryVersion: M06_FORMULA_REGISTRY_VERSION,
    canonicalizationVersion: M06_CANONICALIZATION_VERSION,
    requiredFinancing: rf,
    annuity: ann,
    status: combineStatus(rf, ann),
    codes: [...rf.codes, ...ann.codes],
    blockers,
  };

  const replaySource: ReplaySource = {
    schema_version: M06_SCHEMA_VERSION,
    case_id: ctx.caseId,
    client_profile_snapshot: {
      snapshot_id: ctx.clientProfileSnapshot.snapshotId,
      snapshot_hash: ctx.clientProfileSnapshot.snapshotHash,
    },
    selected_upstream_refs: ctx.selectedUpstreamRefs,
    formula_registry_version: M06_FORMULA_REGISTRY_VERSION,
    formula_versions: [...M06_FORMULA_VERSIONS],
    inputs: canonicalInputs as CanonicalValue,
    outputs: canonicalOutputs,
    blockers: blockers as unknown as CanonicalValue[],
    engine_version: M06_ENGINE_VERSION,
    decimal_context_version: M06_DECIMAL_CONTEXT_VERSION,
  };

  const hashes = computeCasaCjHashes(replaySource);

  return {
    inputHash: hashes.inputHash,
    outputHash: hashes.outputHash,
    replayHash: hashes.replayHash,
    canonicalizationVersion: hashes.canonicalizationVersion,
    canonicalReplayPayload: hashes.canonicalReplayPayload,
    replayPayload: JSON.parse(hashes.canonicalReplayPayload) as Record<string, CanonicalValue>,
    canonicalInputs: canonicalInputs as CanonicalValue,
    canonicalOutputs,
    results,
  };
}
