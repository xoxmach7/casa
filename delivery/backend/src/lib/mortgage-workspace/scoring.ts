/**
 * CASA-скоринг доступности ипотеки: «потянет ли клиент вот эту квартиру».
 *
 * Это НЕ решение банка и НЕ регуляторный КДН (REG-F-001 остаётся DISABLED —
 * его нормативные входы не определены). Здесь считается предварительная оценка
 * CASA по данным, которые есть у брокера: цена объекта, взнос, доход, текущие
 * платежи по кредитам из отчёта ПКБ и параметры прогона (ставка, срок, доля
 * дохода на платёж). Доля дохода — параметр брокера, а не норматив.
 *
 * Арифметика идёт через те же примитивы M06 (CALC-F-001 / CALC-F-002), поэтому
 * суммы согласованы с детерминированным движком, а не считаются вторым способом.
 *
 * Инвариант тот же, что во всём модуле: UNKNOWN ≠ 0. Не хватает входа —
 * возвращается NEEDS_DATA со списком недостающего, а не число от нуля.
 */

import { Prisma } from '@prisma/client';
import {
  requiredFinancing,
  annuityPaymentByParameters,
  type CalcResult,
  type StatusedMoney,
  type InputStatus,
} from './m06-calc';

const MoneyDecimal = Prisma.Decimal.clone({
  precision: 50,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN,
});
type MDecimal = InstanceType<typeof MoneyDecimal>;
const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export const CASA_SCORING_VERSION = 'casa-scoring/1.0.0';

/** Доля дохода, которую клиент направляет на платёж, если брокер не задал свою. */
export const DEFAULT_PAYMENT_SHARE_PERCENT = '50';

export type ScoringVerdict = 'FITS' | 'NOT_ENOUGH' | 'NEEDS_DATA' | 'INVALID_INPUT';

export interface ScoringMoney {
  raw: string | null;
  value: string | null;
  displayKzt: number | null;
}

export interface MissingInput {
  field: string;
  /** Что именно сделать брокеру, человеческим языком. */
  action: string;
}

export interface ScoringResult {
  version: string;
  verdict: ScoringVerdict;
  /** Проверено ли всё документами (иначе часть входов — со слов клиента). */
  unverifiedInputs: boolean;
  requiredFinancing: CalcResult;
  monthlyPayment: CalcResult;
  /** Свободный платёж = доход × доля − текущие обязательства. */
  paymentCapacity: ScoringMoney;
  /** Максимальный кредит, который вытягивает свободный платёж. */
  maxLoan: ScoringMoney;
  /** Насколько платёж по квартире превышает свободный (или 0). */
  paymentGap: ScoringMoney;
  /** Насколько не хватает суммы кредита (или 0). */
  loanGap: ScoringMoney;
  missing: MissingInput[];
  codes: string[];
  parameters: {
    annualNominalRatePercent: string | null;
    termMonths: number | null;
    paymentSharePercent: string;
  };
  disclaimer: string;
}

export interface ScoringInput {
  targetPrice: StatusedMoney;
  availableNowDownPayment: StatusedMoney;
  monthlyIncome: StatusedMoney;
  /** Платежи по действующим кредитам — из отчёта ПКБ. */
  monthlyCreditPayments: StatusedMoney;
  /** Прочие ежемесячные обязательства из анкеты (алименты, аренда и т.п.). */
  monthlyOtherCommitments?: StatusedMoney;
  annualNominalRatePercent: StatusedMoney;
  termMonths: number | null | undefined;
  paymentSharePercent?: string | null;
}

const DISCLAIMER =
  'Предварительная оценка CASA по данным брокера. Это не решение банка, '
  + 'не расчёт банковского КДН и не вероятность одобрения.';

interface Norm {
  dec: MDecimal | null;
  status: InputStatus;
}

function norm(raw: StatusedMoney): Norm {
  let value: unknown = raw;
  let status: InputStatus | undefined;
  if (raw !== null && typeof raw === 'object') {
    value = (raw as { value?: unknown }).value;
    status = (raw as { status?: InputStatus }).status;
  }
  if (value === null || value === undefined || value === '') {
    return { dec: null, status: status ?? 'MISSING' };
  }
  const d = new MoneyDecimal(value as string | number);
  if (!d.isFinite()) return { dec: null, status: 'MISSING' };
  return { dec: d, status: status ?? 'CONFIRMED' };
}

const usable = (n: Norm): boolean =>
  n.dec !== null && n.status !== 'UNKNOWN' && n.status !== 'MISSING'
  && n.status !== 'CONFLICT' && n.status !== 'STALE';

const money = (raw: MDecimal | null): ScoringMoney => (raw === null
  ? { raw: null, value: null, displayKzt: null }
  : {
    raw: raw.toFixed(),
    value: raw.toDecimalPlaces(2, ROUND_HALF_UP).toFixed(2),
    displayKzt: raw.toDecimalPlaces(0, ROUND_HALF_UP).toNumber(),
  });

const zero = (): ScoringMoney => money(new MoneyDecimal(0));

/**
 * Максимальный кредит, который вытягивает платёж C: обратный аннуитет.
 *   r = 0  → L = C * n
 *   r > 0  → L = C * ((1+r)^n - 1) / (r * (1+r)^n)
 */
export function maxLoanByPayment(
  capacity: MDecimal, annualRatePercent: MDecimal, termMonths: number,
): MDecimal {
  if (capacity.lte(0)) return new MoneyDecimal(0);
  const r = annualRatePercent.div(100).div(12);
  if (r.eq(0)) return capacity.mul(termMonths);
  const factor = r.add(1).pow(termMonths);
  return capacity.mul(factor.sub(1)).div(r.mul(factor));
}

export function scoreMortgage(input: ScoringInput): ScoringResult {
  const price = norm(input.targetPrice);
  const down = norm(input.availableNowDownPayment);
  const income = norm(input.monthlyIncome);
  const credit = norm(input.monthlyCreditPayments);
  const other = norm(input.monthlyOtherCommitments ?? '0');
  const rate = norm(input.annualNominalRatePercent);
  const term = input.termMonths ?? null;
  const sharePercent = input.paymentSharePercent?.trim() || DEFAULT_PAYMENT_SHARE_PERCENT;

  const parameters = {
    annualNominalRatePercent: rate.dec ? rate.dec.toFixed() : null,
    termMonths: term,
    paymentSharePercent: sharePercent,
  };

  // Суммы по объекту считает движок M06 — второй реализации арифметики нет.
  const financing = requiredFinancing({
    targetPrice: input.targetPrice,
    availableNowDownPayment: input.availableNowDownPayment,
  });
  const payment = annuityPaymentByParameters({
    principal: financing.value ?? null,
    annualNominalRatePercent: input.annualNominalRatePercent,
    termMonths: term,
  });

  // Чего не хватает — списком действий, а не кодами.
  const missing: MissingInput[] = [];
  if (!usable(price)) missing.push({ field: 'target_price', action: 'Укажите стоимость квартиры' });
  if (!usable(down)) missing.push({ field: 'down_payment', action: 'Добавьте источники первоначального взноса с суммами' });
  if (!usable(income)) missing.push({ field: 'monthly_income', action: 'Добавьте доход клиента в месяц' });
  if (!usable(credit)) missing.push({ field: 'monthly_credit_payments', action: 'Загрузите кредитную историю (ПКБ) — из неё берутся платежи по действующим кредитам' });
  if (!usable(rate)) missing.push({ field: 'rate', action: 'Задайте годовую ставку' });
  if (term === null || term === undefined) missing.push({ field: 'term_months', action: 'Задайте срок кредита' });

  const codes: string[] = [];
  const unverified = [price, down, income, credit, other, rate]
    .some((n) => n.status === 'DECLARED' || n.status === 'EVIDENCE_REQUESTED');
  if (unverified) codes.push('UNVERIFIED_INPUTS');

  const blocked = (verdict: ScoringVerdict, extra: string[]): ScoringResult => ({
    version: CASA_SCORING_VERSION,
    verdict,
    unverifiedInputs: unverified,
    requiredFinancing: financing,
    monthlyPayment: payment,
    paymentCapacity: money(null),
    maxLoan: money(null),
    paymentGap: money(null),
    loanGap: money(null),
    missing,
    codes: [...codes, ...extra],
    parameters,
    disclaimer: DISCLAIMER,
  });

  if (missing.length > 0) return blocked('NEEDS_DATA', ['INCOMPLETE_INPUTS']);

  const share = new MoneyDecimal(sharePercent);
  if (!share.isFinite() || share.lte(0) || share.gt(100)) {
    return blocked('INVALID_INPUT', ['INVALID_PAYMENT_SHARE']);
  }

  if (financing.status === 'INVALID_INPUT' || payment.status === 'INVALID_INPUT') {
    return blocked('INVALID_INPUT', [...financing.codes, ...payment.codes]);
  }
  if (financing.status === 'BLOCKED' || payment.status === 'BLOCKED') {
    return blocked('NEEDS_DATA', [...financing.codes, ...payment.codes]);
  }

  // Свободный платёж: доля дохода минус то, что уже уходит на обязательства.
  const obligations = credit.dec!.add(other.dec ?? new MoneyDecimal(0));
  const capacityRaw = income.dec!.mul(share).div(100).sub(obligations);
  const capacity = capacityRaw.lt(0) ? new MoneyDecimal(0) : capacityRaw;
  if (capacityRaw.lte(0)) codes.push('NO_FREE_PAYMENT_CAPACITY');

  const maxLoan = maxLoanByPayment(capacity, rate.dec!, term as number);

  const neededPayment = new MoneyDecimal(payment.raw ?? '0');
  const neededLoan = new MoneyDecimal(financing.raw ?? '0');
  const paymentGap = neededPayment.sub(capacity);
  const loanGap = neededLoan.sub(maxLoan);

  const fits = paymentGap.lte(0);
  codes.push(fits ? 'WITHIN_CAPACITY' : 'EXCEEDS_CAPACITY');
  if (neededLoan.eq(0)) codes.push('NO_FINANCING_NEEDED');

  return {
    version: CASA_SCORING_VERSION,
    verdict: fits ? 'FITS' : 'NOT_ENOUGH',
    unverifiedInputs: unverified,
    requiredFinancing: financing,
    monthlyPayment: payment,
    paymentCapacity: money(capacity),
    maxLoan: money(maxLoan),
    paymentGap: paymentGap.gt(0) ? money(paymentGap) : zero(),
    loanGap: loanGap.gt(0) ? money(loanGap) : zero(),
    missing: [],
    codes,
    parameters,
    disclaimer: DISCLAIMER,
  };
}
