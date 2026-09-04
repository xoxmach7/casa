/**
 * Подбор ипотечных программ под конкретного клиента и конкретную квартиру.
 *
 * Отвечает на вопрос брокера «на что клиент может рассчитывать»: по каждой
 * программе из справочника считается платёж по ЕЁ ставке и сроку, переплата, и
 * проверяются формальные условия самой программы — минимальный взнос,
 * предельная сумма займа, предельный срок, тип жилья.
 *
 * ГРАНИЦА, КОТОРУЮ ЗДЕСЬ НЕЛЬЗЯ ПЕРЕЙТИ (M06 §17): «подходит» означает
 * «клиент проходит по формальным условиям программы и по свободному платежу»,
 * а НЕ «банк одобрит». Скоринг заявителя, КДН и решение по заявке остаются за
 * банком; CASA не считает и не показывает вероятность одобрения.
 *
 * Арифметика — те же примитивы M06 (CALC-F-001/002), что и в остальном модуле,
 * чтобы платёж по программе и платёж в расчёте не расходились.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { requiredFinancing, annuityPaymentByParameters, type StatusedMoney } from './m06-calc';

const MoneyDecimal = Prisma.Decimal.clone({
  precision: 50,
  rounding: Prisma.Decimal.ROUND_HALF_EVEN,
});
type MDecimal = InstanceType<typeof MoneyDecimal>;
const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export type ProgramPropertyType = 'NEW_BUILDING' | 'SECONDARY';

export interface ProgramMatchInput {
  /** Стоимость квартиры и доступный взнос — как в скоринге, со статусами. */
  targetPrice: StatusedMoney;
  availableNowDownPayment: StatusedMoney;
  /** Свободный платёж клиента: уже посчитан скорингом (доход × доля − обязательства). */
  paymentCapacity: string | null;
  /** Желаемый срок; по программе он может быть урезан до её предела. */
  termMonths: number | null | undefined;
  propertyType?: ProgramPropertyType | null;
}

export interface ProgramMatch {
  id: string;
  bankName: string;
  programName: string;
  propertyType: string;
  /** Ставка «от … до …»: банк публикует диапазон, показывать одну границу нечестно. */
  ratePercentFrom: string;
  ratePercentTo: string | null;
  aprFrom: string | null;
  minDownPaymentPercent: string;
  maxTermMonths: number;
  maxAmountKzt: string | null;
  requirements: string;
  sourceUrl: string | null;
  ratesAsOf: string | null;

  termMonthsUsed: number;
  termCappedByProgram: boolean;
  loanAmount: string | null;
  /**
   * Платёж по НИЖНЕЙ границе ставки — лучший случай. Показывать только его
   * нельзя: у программ вроде «0,1-18,5%» это отличается в разы, и брокер
   * назвал бы клиенту цифру, которой тот не увидит.
   */
  monthlyPayment: string | null;
  /** Платёж по ВЕРХНЕЙ границе ставки. Совпадает с нижним, если ставка одна. */
  monthlyPaymentMax: string | null;
  /** Переплата = платёж × срок − сумма займа. Считает сервер, не браузер. */
  overpayment: string | null;
  overpaymentMax: string | null;

  fits: boolean;
  /** Почему не подходит — человеческим языком, для брокера. */
  blockers: string[];
}

export interface ProgramMatchResult {
  disclaimer: string;
  downPaymentPercent: string | null;
  items: ProgramMatch[];
}

const DISCLAIMER =
  'Программа подходит по своим формальным условиям и по свободному платежу клиента. '
  + 'Это не одобрение: решение по заявке принимает банк.';

function money(value: MDecimal): string {
  return value.toDecimalPlaces(2, ROUND_HALF_UP).toFixed(2);
}

/**
 * Пригодное к счёту число: пустое остаётся пустым и не превращается в ноль.
 * StatusedMoney бывает и голым числом, и объектом со статусом — разбираем оба.
 */
function usable(v: StatusedMoney): MDecimal | null {
  const raw = v !== null && typeof v === 'object' ? v.value : v;
  if (raw === null || raw === undefined || raw === '') return null;
  const d = new MoneyDecimal(raw);
  return d.isFinite() ? d : null;
}

export async function matchPrograms(input: ProgramMatchInput): Promise<ProgramMatchResult> {
  const price = usable(input.targetPrice);
  const down = usable(input.availableNowDownPayment);
  const capacity = input.paymentCapacity === null || input.paymentCapacity === undefined
    ? null
    : new MoneyDecimal(input.paymentCapacity);

  const downPercent = price && down && price.gt(0)
    ? down.div(price).mul(100)
    : null;

  const programs = await prisma.mortgageProgram.findMany({
    where: {
      isActive: true,
      ...(input.propertyType ? { propertyType: input.propertyType } : {}),
    },
    orderBy: [{ interestRate: 'asc' }, { id: 'asc' }],
    take: 60,
  });

  const items: ProgramMatch[] = programs.map((p) => {
    const blockers: string[] = [];

    const requestedTerm = input.termMonths ?? p.maxTerm;
    // Считать платёж на сроке, которого у программы нет, — вводить в заблуждение.
    const termUsed = Math.min(requestedTerm, p.maxTerm);

    const financing = requiredFinancing({
      targetPrice: input.targetPrice,
      availableNowDownPayment: input.availableNowDownPayment,
    });
    const loan = financing.raw === null ? null : new MoneyDecimal(financing.raw);

    const principal: StatusedMoney = {
      value: financing.raw,
      status: financing.raw === null ? 'MISSING' : 'DECLARED',
    };
    const paymentAt = (ratePercent: string) => {
      const r = annuityPaymentByParameters({
        principal,
        annualNominalRatePercent: { value: ratePercent, status: 'DECLARED' },
        termMonths: termUsed,
      });
      return r.raw === null ? null : new MoneyDecimal(r.raw);
    };

    const rateTo = p.interestRateTo ? p.interestRateTo.toString() : p.interestRate.toString();
    const monthly = paymentAt(p.interestRate.toString());
    const monthlyMax = paymentAt(rateTo);

    const over = (m: MDecimal | null) => (m && loan ? m.mul(termUsed).sub(loan) : null);
    const overpayment = over(monthly);
    const overpaymentMax = over(monthlyMax);

    // 1. Минимальный взнос программы.
    if (downPercent !== null && downPercent.lt(p.minDownPayment.toString())) {
      blockers.push(
        `нужен взнос от ${p.minDownPayment.toString()}%, у клиента ${downPercent.toDecimalPlaces(1, ROUND_HALF_UP).toString()}%`,
      );
    }
    // 2. Предельная сумма займа.
    if (loan && p.maxAmountKzt && loan.gt(p.maxAmountKzt.toString())) {
      blockers.push(
        `сумма займа выше предела программы (${new MoneyDecimal(p.maxAmountKzt.toString()).toDecimalPlaces(0, ROUND_HALF_UP).toString()} ₸)`,
      );
    }
    // 3. Свободный платёж клиента. Сверяем по НИЖНЕЙ границе: если даже
    //    лучший случай не проходит, программа отпадает наверняка. Когда
    //    проходит лучший, но не худший — это предупреждение, а не отказ.
    if (monthly && capacity !== null && monthly.gt(capacity)) {
      blockers.push('платёж больше свободного платежа клиента');
    }
    // 4. Нечего считать.
    if (loan === null || monthly === null) {
      blockers.push('не хватает данных для расчёта по этой программе');
    }
    if (downPercent === null) {
      blockers.push('неизвестна доля первоначального взноса');
    }

    return {
      id: p.id,
      bankName: p.bankName,
      programName: p.programName,
      propertyType: p.propertyType,
      ratePercentFrom: p.interestRate.toString(),
      ratePercentTo: p.interestRateTo ? p.interestRateTo.toString() : null,
      aprFrom: p.aprFrom ? p.aprFrom.toString() : null,
      minDownPaymentPercent: p.minDownPayment.toString(),
      maxTermMonths: p.maxTerm,
      maxAmountKzt: p.maxAmountKzt ? p.maxAmountKzt.toString() : null,
      requirements: p.requirements,
      sourceUrl: p.sourceUrl ?? null,
      ratesAsOf: p.ratesAsOf ? p.ratesAsOf.toISOString().slice(0, 10) : null,
      termMonthsUsed: termUsed,
      termCappedByProgram: termUsed !== requestedTerm,
      loanAmount: loan ? money(loan) : null,
      monthlyPayment: monthly ? money(monthly) : null,
      monthlyPaymentMax: monthlyMax ? money(monthlyMax) : null,
      overpayment: overpayment ? money(overpayment) : null,
      overpaymentMax: overpaymentMax ? money(overpaymentMax) : null,
      fits: blockers.length === 0,
      blockers,
    };
  });

  // Подходящие — вперёд, внутри группы дешевле платёж — выше: брокер называет
  // клиенту лучший вариант первым.
  items.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    const pa = a.monthlyPayment === null ? Number.POSITIVE_INFINITY : Number(a.monthlyPayment);
    const pb = b.monthlyPayment === null ? Number.POSITIVE_INFINITY : Number(b.monthlyPayment);
    return pa - pb;
  });

  return {
    disclaimer: DISCLAIMER,
    downPaymentPercent: downPercent ? downPercent.toDecimalPlaces(1, ROUND_HALF_UP).toString() : null,
    items,
  };
}
