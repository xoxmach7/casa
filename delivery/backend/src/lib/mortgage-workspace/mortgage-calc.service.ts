/**
 * M06 Calculation Engine — исполнение расчётного прогона поверх утверждённых
 * формул `m06-calc.ts` (CALC-F-001/002). Чистая логика: НЕ трогает БД и НЕ
 * принимает PDF (INV-0032 "NO PDF") — только параметры/статусы входов.
 *
 * Хэши: детерминированная канонизация (сорт-ключи JSON → sha256). Это НЕ полный
 * CASA-CJ-1 §29 (его канонизация — в .docx, не в CSV), но детерминированный и
 * воспроизводимый: одинаковые входы → одинаковый input_hash/output_hash. Поле
 * `hashMethod` помечает версию, чтобы позже переключить на CASA-CJ-1 без ломки.
 */

import crypto from 'crypto';
import {
  requiredFinancing,
  annuityPaymentByParameters,
  type CalcResult,
  type StatusedMoney,
} from './m06-calc';

export const M06_ENGINE_VERSION = 'M06/v1.4';
export const M06_DECIMAL_CONTEXT_VERSION = 'casa.decimal_context/p50-half-even__money-half-up/1.0.0';
export const M06_HASH_METHOD = 'casa.sorted-json-sha256/1.0.0'; // не CASA-CJ-1 §29

export interface CalculationInputs {
  targetPriceMax: StatusedMoney;
  availableNowTotal: StatusedMoney;
  annualNominalRatePercent: StatusedMoney;
  termMonths: number | null | undefined;
}

export interface CalculationResults {
  engineVersion: string;
  decimalContextVersion: string;
  hashMethod: string;
  requiredFinancing: CalcResult;
  annuity: CalcResult;
  status: CalcResult['status'];
  codes: string[];
}

export interface CalculationOutput {
  inputHash: string;
  outputHash: string;
  results: CalculationResults;
}

/** Детерминированная канонизация: рекурсивная сортировка ключей объекта. */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(norm);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = norm((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(norm(value));
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Свести статусы двух формул в один статус прогона (худший из значимых). */
function combineStatus(a: CalcResult, b: CalcResult): CalcResult['status'] {
  const order: CalcResult['status'][] = ['BLOCKED', 'INVALID_INPUT', 'COMPLETED_WITH_LIMITATIONS', 'COMPLETED'];
  for (const s of order) if (a.status === s || b.status === s) return s;
  return 'COMPLETED';
}

/**
 * Исполнить прогон: required_financing = max(P − A, 0); затем аннуитет с
 * principal = required_financing. Если финансирование заблокировано —
 * аннуитет тоже блокируется (principal неизвестен), ноль не подставляется.
 */
export function runCalculation(inputs: CalculationInputs): CalculationOutput {
  const rf = requiredFinancing({
    targetPrice: inputs.targetPriceMax,
    availableNowDownPayment: inputs.availableNowTotal,
  });

  const principal: StatusedMoney = rf.value !== null ? rf.value : { status: 'UNKNOWN' };
  const ann = annuityPaymentByParameters({
    principal,
    annualNominalRatePercent: inputs.annualNominalRatePercent,
    termMonths: inputs.termMonths,
  });

  const results: CalculationResults = {
    engineVersion: M06_ENGINE_VERSION,
    decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
    hashMethod: M06_HASH_METHOD,
    requiredFinancing: rf,
    annuity: ann,
    status: combineStatus(rf, ann),
    codes: [...rf.codes, ...ann.codes],
  };

  const inputHash = sha256Hex(canonicalJson({
    inputs,
    engineVersion: M06_ENGINE_VERSION,
    decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
  }));
  const outputHash = sha256Hex(canonicalJson(results));

  return { inputHash, outputHash, results };
}
