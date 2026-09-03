/**
 * Снятие объекта с площадки — момент истины.
 *
 * Собственник снимает объект тогда, когда продал. Если не спросить его в
 * этот момент, кому именно, платформа никогда не узнает, что сделка была, и
 * комиссия просто не появится. Поэтому снять объект, не заполнив эту форму,
 * нельзя.
 *
 * Сверка перекрёстная: заявление собственника сопоставляется с фиксациями,
 * которые ещё в защитном периоде. Совпадение отпечатка покупателя при
 * ответе «продал сам» — это не обвинение, а основание открыть спор и
 * позвать человека.
 */

import { Prisma } from '@prisma/client';
import type { ListingExitOutcome } from '@prisma/client';
import { prisma } from '../prisma';
import { buyerIdentityHash } from './identity';
import { findCoveringFixation } from './fixation.service';

export class ListingExitError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'ListingExitError';
  }
}

export interface DeclareExitInput {
  propertyId: string;
  outcome: ListingExitOutcome;
  /** Телефон покупателя — обязателен, если объект продан. */
  buyerPhone?: string | null;
  declaredPrice?: string | null;
  declaredBy: string;
  comment?: string | null;
}

const SOLD_OUTCOMES: ListingExitOutcome[] = ['SOLD_VIA_PLATFORM', 'SOLD_OUTSIDE'];

export async function declareListingExit(input: DeclareExitInput) {
  const property = await prisma.crmProperty.findUnique({
    where: { id: input.propertyId },
    select: { id: true, status: true },
  });
  if (!property) {
    throw new ListingExitError('Объект не найден', 'PROPERTY_NOT_FOUND', 404);
  }

  const isSold = SOLD_OUTCOMES.includes(input.outcome);
  if (isSold && !input.buyerPhone) {
    // Без покупателя заявление о продаже бесполезно: сверять не с чем.
    throw new ListingExitError(
      'Для проданного объекта нужен телефон покупателя',
      'BUYER_PHONE_REQUIRED',
    );
  }

  const identityHash = input.buyerPhone ? buyerIdentityHash(input.buyerPhone) : null;

  const covering = identityHash
    ? await findCoveringFixation(input.propertyId, identityHash)
    : null;

  // Спор открывается ровно в одном случае: собственник говорит «продал
  // сам», а покупатель — тот, кого привёл агент, и защитный период ещё идёт.
  const disputeOpened = input.outcome === 'SOLD_OUTSIDE' && Boolean(covering);

  return prisma.$transaction(async (tx) => {
    const exit = await tx.listingExit.create({
      data: {
        propertyId: input.propertyId,
        outcome: input.outcome,
        buyerIdentityHash: identityHash,
        declaredPrice: input.declaredPrice ? new Prisma.Decimal(input.declaredPrice) : null,
        declaredBy: input.declaredBy,
        comment: input.comment || null,
        matchedFixationId: covering?.id ?? null,
        disputeOpened,
      },
    });

    await tx.crmProperty.update({
      where: { id: input.propertyId },
      data: {
        funnelStage: isSold ? 'SOLD' : 'CANCELLED',
        status: isSold ? 'SOLD' : 'ARCHIVED',
      },
    });

    // Действующие договоры закрываются вместе с объектом: иначе объект
    // остаётся «публикуемым» и может всплыть снова.
    await tx.listingAgreement.updateMany({
      where: { propertyId: input.propertyId, status: 'ACTIVE' },
      data: {
        status: 'TERMINATED',
        terminatedAt: new Date(),
        terminationReason: `Объект снят с площадки: ${input.outcome}`,
      },
    });

    return exit;
  });
}

/** Открытые споры — рабочий список админа. */
export async function listOpenDisputes() {
  return prisma.listingExit.findMany({
    where: { disputeOpened: true },
    orderBy: { createdAt: 'desc' },
    include: {
      property: {
        select: { id: true, residentialComplex: true, district: true, rooms: true, area: true },
      },
    },
  });
}
