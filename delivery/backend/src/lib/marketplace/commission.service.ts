/**
 * Комиссия по сделке вторички.
 *
 * До этого модуля сделка вторички доходила до `sold` — и деньги платформы
 * на этом заканчивались: `Commission` умела висеть только на `Deal` из
 * канбана новостроек.
 *
 * Сумма НЕ вводится руками. Она считается из договора с собственником,
 * принятого до публикации объекта, и из доли, объявленной агенту в момент
 * фиксации. Ручной ввод вернул бы ровно ту дыру, ради которой всё это
 * строилось: договорённость, о которой можно передоговориться постфактум.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { activeAgreementFor } from './listing-agreement.service';

export class CommissionError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'CommissionError';
  }
}

/** Деньги округляем до копеек HALF_UP — как и везде в проекте. */
function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface CommissionBreakdown {
  amount: Prisma.Decimal;
  partnerShare: Prisma.Decimal;
  casaShare: Prisma.Decimal;
  commissionPercent: Prisma.Decimal;
  sharePercent: Prisma.Decimal;
}

/**
 * Комиссия собственника и её раздел.
 *
 * `casaShare` считается вычитанием, а не вторым умножением: иначе на
 * округлении доли перестают сходиться с целым, и в отчётах появляются
 * копейки из ниоткуда.
 */
export function computeCommission(
  finalPrice: Prisma.Decimal | string,
  commissionPercent: Prisma.Decimal | string,
  sharePercent: Prisma.Decimal | string,
): CommissionBreakdown {
  const price = new Prisma.Decimal(finalPrice);
  const percent = new Prisma.Decimal(commissionPercent);
  const share = new Prisma.Decimal(sharePercent);

  if (price.lessThanOrEqualTo(0)) {
    throw new CommissionError('Цена сделки должна быть больше нуля', 'INVALID_PRICE');
  }

  const amount = money(price.mul(percent).div(100));
  const partnerShare = money(amount.mul(share).div(100));
  const casaShare = money(amount.sub(partnerShare));

  return { amount, partnerShare, casaShare, commissionPercent: percent, sharePercent: share };
}

/**
 * Создаёт комиссию по закрытой сделке вторички.
 *
 * Идемпотентна: повторный вызов возвращает уже созданную запись, а не
 * задваивает начисление.
 */
export async function createCommissionForSecondaryDeal(secondaryDealId: string) {
  const existing = await prisma.commission.findUnique({ where: { secondaryDealId } });
  if (existing) return existing;

  const deal = await prisma.secondaryDeal.findUnique({
    where: { id: secondaryDealId },
    select: { id: true, propertyId: true, stage: true, finalPrice: true, fixation: true },
  });
  if (!deal) throw new CommissionError('Сделка не найдена', 'DEAL_NOT_FOUND', 404);
  if (!deal.finalPrice) {
    throw new CommissionError(
      'У сделки не указана итоговая цена — комиссию не с чего считать',
      'FINAL_PRICE_MISSING',
      409,
    );
  }

  const agreement = await activeAgreementFor(deal.propertyId);
  if (!agreement) {
    throw new CommissionError(
      'У объекта нет действующего договора с собственником',
      'LISTING_AGREEMENT_REQUIRED',
      409,
    );
  }

  // Доля агента берётся из ФИКСАЦИИ, а не из текущего договора: агенту
  // обещали конкретный процент в момент, когда он привёл покупателя.
  const sharePercent = deal.fixation?.declaredSharePercent ?? agreement.buyerAgentSharePercent;

  const breakdown = computeCommission(
    deal.finalPrice,
    agreement.commissionPercent,
    sharePercent,
  );

  return prisma.$transaction(async (tx) => {
    const commission = await tx.commission.create({
      data: {
        secondaryDealId,
        amount: breakdown.amount,
        partnerShare: breakdown.partnerShare,
        casaShare: breakdown.casaShare,
        partnerAgentId: deal.fixation?.agentId ?? null,
        status: 'CONFIRMED',
      },
    });
    await tx.commissionStatusLog.create({
      data: {
        commissionId: commission.id,
        fromStatus: null,
        toStatus: 'CONFIRMED',
        note:
          `Начислена автоматически: ${breakdown.commissionPercent.toString()}% от ` +
          `${new Prisma.Decimal(deal.finalPrice!).toString()} ₸, доля агента ` +
          `${breakdown.sharePercent.toString()}%`,
      },
    });
    return commission;
  });
}

/**
 * Комиссия по сделке, прошедшей мимо площадки, но покрытой защитным
 * периодом. Создаётся сразу в статусе DISPUTED: это претензия, а не
 * подтверждённое начисление, и решать её будет человек.
 */
export async function createDisputedCommission(input: {
  propertyId: string;
  fixationId: string;
  declaredPrice: Prisma.Decimal | string;
  note: string;
}) {
  const agreement = await activeAgreementFor(input.propertyId);
  if (!agreement) return null;

  const fixation = await prisma.secondaryFixation.findUnique({
    where: { id: input.fixationId },
    select: { id: true, agentId: true, declaredSharePercent: true, secondaryDealId: true },
  });
  if (!fixation) return null;

  // Комиссия привязывается к сделке. Сделки мимо площадки у нас нет, поэтому
  // без SecondaryDeal запись создать некуда — CHECK-констрейнт требует ровно
  // одну ссылку. Такой спор фиксируем в самой записи о снятии объекта.
  if (!fixation.secondaryDealId) return null;

  const breakdown = computeCommission(
    input.declaredPrice,
    agreement.commissionPercent,
    fixation.declaredSharePercent,
  );

  return prisma.commission.create({
    data: {
      secondaryDealId: fixation.secondaryDealId,
      amount: breakdown.amount,
      partnerShare: breakdown.partnerShare,
      casaShare: breakdown.casaShare,
      partnerAgentId: fixation.agentId,
      status: 'DISPUTED',
      statusHistory: {
        create: { fromStatus: null, toStatus: 'DISPUTED', note: input.note },
      },
    },
  });
}
