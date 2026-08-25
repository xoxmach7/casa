/**
 * CASA Pro Ипотека — M06 Calculation Engine (Production Spec v1.4, FROZEN).
 *
 * Реализация СТРОГО по утверждённому реестру формул и фикстурам M06 (governance
 * DEC-M06-001, APPROVED_FROZEN_BY_OWNER; DEC-RG10-001). Две APPROVED-формулы:
 *   CALC-F-001  casa.required_financing            v1.0.0  F = max(P − A_now, 0)
 *   CALC-F-002  casa.annuity_payment_by_parameters v1.0.0
 * REG-F-001 (reg.kz.kdn.bank) — DISABLED: намеренно отсутствует.
 *
 * Контракт точности (§18, decimal_context p50-half-even__money-half-up):
 *  внутри — 50 знаков ROUND_HALF_EVEN без промежуточной квантизации; персист —
 *  Decimal(20,2) ROUND_HALF_UP один раз; показ — целые ₸ ROUND_HALF_UP от сырого.
 *
 * Коды/статусы соответствуют фикстурам §28–§29 (FX-FIN-001…009, FX-ANN-001…009,
 * FX-CALC-GOLDEN-001) и таксономии §19. Входы несут СТАТУС (CONFIRMED/DECLARED/
 * EVIDENCE_REQUESTED/MISSING/UNKNOWN/STALE/CONFLICT) — от него зависят blocker'ы
 * и COMPLETED_WITH_LIMITATIONS/UNVERIFIED_INPUTS. UNKNOWN ≠ 0; движок не угадывает.
 *
 * RG10/RG11/RG12 остаются NOT_PASS до подписи владельца по evidence (DEC-RG10-001);
 * прогон фикстур в этом файле — часть доказательной базы, но не перевод gate в PASS.
 */

import { Prisma } from '@prisma/client';

// Изолированный Decimal с контекстом M06 (глобальный Prisma.Decimal не трогаем).
const MoneyDecimal = Prisma.Decimal.clone({
  precision: 50,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN, // 6
});
type MDecimal = InstanceType<typeof MoneyDecimal>;
const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP; // 4

/** Статус входного поля (провенанс/состояние) — §19. */
export type InputStatus =
  | 'CONFIRMED'
  | 'DECLARED' // заявлено, не подтверждено → COMPLETED_WITH_LIMITATIONS
  | 'EVIDENCE_REQUESTED' // запрошено подтверждение → тоже unverified
  | 'MISSING'
  | 'UNKNOWN'
  | 'STALE'
  | 'CONFLICT';

/** Денежный вход: голое значение (=CONFIRMED) или конверт со статусом. */
export type MoneyInput = number | string | null | undefined;
export type StatusedMoney = MoneyInput | { value?: MoneyInput; status?: InputStatus };

export type CalcStatus = 'COMPLETED' | 'COMPLETED_WITH_LIMITATIONS' | 'BLOCKED' | 'INVALID_INPUT';

export interface CalcResult {
  formulaId: 'CALC-F-001' | 'CALC-F-002';
  machineName: string;
  formulaVersion: string;
  /** Сырое значение 50-знаков (для golden/replay); null при блоке. */
  raw: string | null;
  /** Персист Decimal(20,2) ROUND_HALF_UP; null при блоке. */
  value: string | null;
  /** Целые ₸ (ROUND_HALF_UP от сырого); null при блоке. */
  displayKzt: number | null;
  status: CalcStatus;
  /** Коды §19/§28 (blocker'ы или информационные метки), в порядке входов. */
  codes: string[];
  currency: 'KZT';
}

interface NormInput {
  name: string;
  dec: MDecimal | null;
  status: InputStatus;
}

function requireMoney(v: MoneyInput): MDecimal | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new MoneyDecimal(v);
  return d.isFinite() ? d : null;
}

function normInput(name: string, raw: StatusedMoney): NormInput {
  let value: MoneyInput;
  let status: InputStatus | undefined;
  if (raw !== null && typeof raw === 'object') {
    value = raw.value;
    status = raw.status;
  } else {
    value = raw;
  }
  const dec = requireMoney(value);
  if (!status) status = dec === null ? 'MISSING' : 'CONFIRMED';
  // CONFIRMED, но значение не распарсилось → трактуем как MISSING (не угадываем).
  if (status === 'CONFIRMED' && dec === null) status = 'MISSING';
  return { name, dec, status };
}

/** Блокирующий код по статусу входа (§19), либо null. */
function blockingCode(i: NormInput): string | null {
  switch (i.status) {
    case 'MISSING': return `MISSING_INPUT:${i.name}`;
    case 'UNKNOWN': return `UNKNOWN_INPUT:${i.name}`;
    case 'STALE': return `STALE_INPUT:${i.name}`;
    case 'CONFLICT': return `CONFLICTING_INPUT:${i.name}`;
    default: return null;
  }
}
const isUnverified = (i: NormInput): boolean => i.status === 'DECLARED' || i.status === 'EVIDENCE_REQUESTED';

function persist(raw: MDecimal): string { return raw.toDecimalPlaces(2, ROUND_HALF_UP).toFixed(2); }
function displayKzt(raw: MDecimal): number { return raw.toDecimalPlaces(0, ROUND_HALF_UP).toNumber(); }

function fail(
  formulaId: CalcResult['formulaId'], name: string, ver: string,
  status: 'BLOCKED' | 'INVALID_INPUT', codes: string[],
): CalcResult {
  return { formulaId, machineName: name, formulaVersion: ver, raw: null, value: null, displayKzt: null, status, codes, currency: 'KZT' };
}

function ok(
  formulaId: CalcResult['formulaId'], name: string, ver: string,
  raw: MDecimal, extraCodes: string[], unverified: boolean,
): CalcResult {
  const codes = [...extraCodes];
  if (unverified) codes.push('UNVERIFIED_INPUTS');
  return {
    formulaId, machineName: name, formulaVersion: ver,
    raw: raw.toFixed(), value: persist(raw), displayKzt: displayKzt(raw),
    status: unverified ? 'COMPLETED_WITH_LIMITATIONS' : 'COMPLETED', codes, currency: 'KZT',
  };
}

// --- CALC-F-001  casa.required_financing v1.0.0 -----------------------------
// F = max(P − A_now, 0). ₸, без FX.

export interface RequiredFinancingInput {
  targetPrice: StatusedMoney;
  availableNowDownPayment: StatusedMoney;
}

export function requiredFinancing(input: RequiredFinancingInput): CalcResult {
  const id = 'CALC-F-001' as const;
  const name = 'casa.required_financing';
  const ver = '1.0.0';
  const P = normInput('P', input.targetPrice);
  const A = normInput('A', input.availableNowDownPayment);
  const inputs = [P, A];

  const blocks = inputs.map(blockingCode).filter((c): c is string => c !== null);
  if (blocks.length) return fail(id, name, ver, 'BLOCKED', blocks);

  const neg = inputs.find((i) => i.dec!.lt(0));
  if (neg) return fail(id, name, ver, 'INVALID_INPUT', [`NEGATIVE_AMOUNT:${neg.name}`]);

  const raw = MoneyDecimal.max(P.dec!.sub(A.dec!), 0);
  const codes: string[] = [];
  if (A.dec!.gte(P.dec!)) codes.push('DOWN_PAYMENT_COVERS_TARGET'); // FX-FIN-003/004
  return ok(id, name, ver, raw, codes, inputs.some(isUnverified));
}

// --- CALC-F-002  casa.annuity_payment_by_parameters v1.0.0 ------------------
// r=a/100/12; P=0→0; r=0,n>0→P/n; r>0,n>0→P·r·(1+r)^n/((1+r)^n−1). MONTHLY.
// §19: INVALID_TERM (n≤0 | n>1200 | не целое); INVALID_RATE (a<0 | a>100).

export interface AnnuityByParametersInput {
  principal: StatusedMoney;
  annualNominalRatePercent: StatusedMoney;
  termMonths: number | null | undefined;
  paymentFrequency?: string;
}

const MAX_TERM_MONTHS = 1200; // §19: 100 лет

export function annuityPaymentByParameters(input: AnnuityByParametersInput): CalcResult {
  const id = 'CALC-F-002' as const;
  const name = 'casa.annuity_payment_by_parameters';
  const ver = '1.0.0';
  const P = normInput('P', input.principal);
  const a = normInput('a', input.annualNominalRatePercent);
  const n = input.termMonths;

  const blocks: string[] = [];
  for (const c of [blockingCode(P), blockingCode(a)]) if (c) blocks.push(c);
  if (n === null || n === undefined) blocks.push('MISSING_INPUT:n');
  if (blocks.length) return fail(id, name, ver, 'BLOCKED', blocks);

  if ((input.paymentFrequency ?? 'MONTHLY') !== 'MONTHLY') {
    return fail(id, name, ver, 'INVALID_INPUT', ['UNSUPPORTED_FREQUENCY']);
  }
  if (P.dec!.lt(0)) return fail(id, name, ver, 'INVALID_INPUT', ['NEGATIVE_AMOUNT:P']);
  if (!Number.isInteger(n as number) || (n as number) <= 0 || (n as number) > MAX_TERM_MONTHS) {
    return fail(id, name, ver, 'INVALID_INPUT', ['INVALID_TERM']);
  }
  if (a.dec!.lt(0) || a.dec!.gt(100)) return fail(id, name, ver, 'INVALID_INPUT', ['INVALID_RATE']);

  const nn = n as number;
  const r = a.dec!.div(100).div(12);
  const codes: string[] = [];
  let raw: MDecimal;
  if (P.dec!.eq(0)) {
    raw = new MoneyDecimal(0); // P = 0 → 0
  } else if (r.eq(0)) {
    raw = P.dec!.div(nn); // r = 0 → P/n
    codes.push('ZERO_RATE_BRANCH'); // FX-ANN-003
  } else {
    const factor = r.add(1).pow(nn);
    raw = P.dec!.mul(r).mul(factor).div(factor.sub(1));
  }
  return ok(id, name, ver, raw, codes, [P, a].some(isUnverified));
}
