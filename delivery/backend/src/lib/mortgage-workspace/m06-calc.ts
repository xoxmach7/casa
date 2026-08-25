/**
 * CASA Pro Ипотека — M06 Calculation Engine (Production Spec v1.4, FROZEN).
 *
 * Реализация СТРОГО по утверждённому реестру формул M06 (governance
 * DEC-M06-001, APPROVED_FROZEN_BY_OWNER; DEC-RG10-001). Здесь — только две
 * утверждённые (APPROVED) формулы:
 *
 *   CALC-F-001  casa.required_financing            v1.0.0
 *   CALC-F-002  casa.annuity_payment_by_parameters v1.0.0
 *
 * Регуляторный/банковский КДН (REG-F-001 reg.kz.kdn.bank) — DISABLED: до
 * появления утверждённых exact regulatory inputs (PNZ/PP/PZ/D) и applicability
 * context он НЕ считается, value=null. В этом модуле его нет намеренно.
 *
 * Контракт точности (M06 §18, decimal_context p50-half-even__money-half-up):
 *  - внутренние операции: 50 значащих десятичных знаков, ROUND_HALF_EVEN,
 *    без промежуточной квантизации;
 *  - персистентность/выдача: Decimal(20,2), ROUND_HALF_UP один раз после
 *    вычисления всего выражения;
 *  - показ: целые ₸ (ROUND_HALF_UP от неквантизованного сырого значения).
 *
 * Политика неизвестного (M06 unknown_policy): любой требуемый вход
 * UNKNOWN/BLANK/STALE/CONFLICT/BLOCKED → value=null + blocker; невалидные
 * term/rate/frequency → INVALID_INPUT. Движок НЕ подставляет ноль вместо
 * UNKNOWN и НЕ угадывает.
 *
 * RG10/RG11/RG12 остаются NOT_PASS до фактического прогона fixtures и
 * получения runtime evidence (DEC-RG10-001) — сам факт этой реализации
 * gate в PASS не переводит.
 */

import { Prisma } from '@prisma/client';

// Изолированный конструктор Decimal с контекстом M06 (не трогаем глобальный
// Prisma.Decimal, чтобы не влиять на остальной код). 50 знаков, ROUND_HALF_EVEN.
const MoneyDecimal = Prisma.Decimal.clone({
  precision: 50,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN, // 6
});
type MDecimal = InstanceType<typeof MoneyDecimal>;

const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP; // 4

/** Вход, который может быть неизвестным по политике M06. */
export type MoneyInput = number | string | null | undefined;

export type CalcBlocker =
  | 'MISSING_REQUIRED_INPUT' // требуемый вход UNKNOWN/BLANK/STALE/CONFLICT/BLOCKED
  | 'INVALID_INPUT'; // невалидные term/rate/frequency и т.п.

export interface CalcResult {
  formulaId: 'CALC-F-001' | 'CALC-F-002';
  machineName: string;
  formulaVersion: string;
  /** Значение Decimal(20,2), персист-округление; null при blocker. */
  value: string | null;
  /** Целые ₸ для показа (ROUND_HALF_UP от сырого); null при blocker. */
  displayKzt: number | null;
  blocker: CalcBlocker | null;
  currency: 'KZT';
}

/** Требуемый денежный вход → Decimal или null (по unknown_policy). */
function requireMoney(v: MoneyInput): MDecimal | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new MoneyDecimal(v);
  return d.isFinite() ? d : null;
}

/** Персист-округление Decimal(20,2) ROUND_HALF_UP один раз после выражения. */
function persist(raw: MDecimal): string {
  return raw.toDecimalPlaces(2, ROUND_HALF_UP).toFixed(2);
}

/** Показ: целые ₸ ROUND_HALF_UP от неквантизованного сырого значения. */
function displayKzt(raw: MDecimal): number {
  return raw.toDecimalPlaces(0, ROUND_HALF_UP).toNumber();
}

function blocked(
  formulaId: CalcResult['formulaId'],
  machineName: string,
  formulaVersion: string,
  blocker: CalcBlocker,
): CalcResult {
  return { formulaId, machineName, formulaVersion, value: null, displayKzt: null, blocker, currency: 'KZT' };
}

// --- CALC-F-001  casa.required_financing v1.0.0 (APPROVED) -------------------
// F = max(P − A_now, 0). Обе величины в ₸, без FX-конвертации.

export interface RequiredFinancingInput {
  targetPrice: MoneyInput;
  availableNowDownPayment: MoneyInput;
}

export function requiredFinancing(input: RequiredFinancingInput): CalcResult {
  const P = requireMoney(input.targetPrice);
  const A = requireMoney(input.availableNowDownPayment);
  if (P === null || A === null) {
    return blocked('CALC-F-001', 'casa.required_financing', '1.0.0', 'MISSING_REQUIRED_INPUT');
  }
  if (P.lt(0) || A.lt(0)) {
    return blocked('CALC-F-001', 'casa.required_financing', '1.0.0', 'INVALID_INPUT');
  }
  const raw = MoneyDecimal.max(P.sub(A), 0);
  return {
    formulaId: 'CALC-F-001',
    machineName: 'casa.required_financing',
    formulaVersion: '1.0.0',
    value: persist(raw),
    displayKzt: displayKzt(raw),
    blocker: null,
    currency: 'KZT',
  };
}

// --- CALC-F-002  casa.annuity_payment_by_parameters v1.0.0 (APPROVED) --------
// r = a/100/12
// if P = 0                 → M = 0
// elif r = 0 and n > 0     → M = P/n
// elif r > 0 and n > 0     → M = P·r·(1+r)^n / ((1+r)^n − 1)
// else                     → INVALID_INPUT
// frequency фиксирована MONTHLY.

export interface AnnuityByParametersInput {
  principal: MoneyInput;
  annualNominalRatePercent: MoneyInput;
  termMonths: number | null | undefined;
  paymentFrequency?: 'MONTHLY';
}

export function annuityPaymentByParameters(input: AnnuityByParametersInput): CalcResult {
  const id = 'CALC-F-002' as const;
  const name = 'casa.annuity_payment_by_parameters';
  const ver = '1.0.0';

  const P = requireMoney(input.principal);
  const a = requireMoney(input.annualNominalRatePercent);
  const n = input.termMonths;

  // Требуемые входы не должны быть UNKNOWN (unknown_policy).
  if (P === null || a === null || n === null || n === undefined) {
    return blocked(id, name, ver, 'MISSING_REQUIRED_INPUT');
  }
  // frequency обязана быть MONTHLY; term/rate валидны.
  if ((input.paymentFrequency ?? 'MONTHLY') !== 'MONTHLY') {
    return blocked(id, name, ver, 'INVALID_INPUT');
  }
  if (!Number.isInteger(n) || n <= 0 || P.lt(0) || a.lt(0)) {
    return blocked(id, name, ver, 'INVALID_INPUT');
  }

  const r = a.div(100).div(12);

  let raw: MDecimal;
  if (P.eq(0)) {
    raw = new MoneyDecimal(0); // P = 0 → M = 0
  } else if (r.eq(0)) {
    raw = P.div(n); // r = 0, n > 0 → P/n
  } else {
    // r > 0, n > 0 → P·r·(1+r)^n / ((1+r)^n − 1)
    const factor = r.add(1).pow(n);
    raw = P.mul(r).mul(factor).div(factor.sub(1));
  }

  return {
    formulaId: id,
    machineName: name,
    formulaVersion: ver,
    value: persist(raw),
    displayKzt: displayKzt(raw),
    blocker: null,
    currency: 'KZT',
  };
}
