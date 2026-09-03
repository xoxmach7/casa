/**
 * Фиксация покупателя на объекте.
 *
 * У неё две работы, и вторая важнее первой.
 *
 * Первая — развести агентов между собой: два агента не могут вести одного
 * покупателя по одному объекту. Это то, что делает `Fixation` в новостройках.
 *
 * Вторая — ДОКАЗАТЬ, что покупателя привела платформа. Собственник платит
 * комиссию и потому мотивирован обойти; висит он при этом ещё и на Krisha.
 * Единственное, что удерживает комиссию, — цепочка улик «фиксация → показ →
 * оффер → сделка» плюс защитный период, в течение которого сделка с тем же
 * покупателем считается нашей, даже если объект уже снят.
 *
 * Поэтому фиксация не может быть необязательной и не может ставиться задним
 * числом: `expiresAt` и `protectionUntil` считаются здесь от текущего
 * времени, а не приходят из запроса.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { buyerIdentityHash } from './identity';
import { termsForTier } from './tiers';
import { activeAgreementFor } from './listing-agreement.service';
import { countLiveFixations, getActiveSubscription, LIVE_FIXATION_STATUSES } from './subscription.service';

export class FixationError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'FixationError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateFixationInput {
  propertyId: string;
  buyerId: string;
  agentId: string;
  agencyId: string;
}

/**
 * Живая фиксация этого агента на этот объект — то, чем открываются адрес и
 * контакты собственника.
 */
export async function liveFixationFor(propertyId: string, agentId: string) {
  return prisma.secondaryFixation.findFirst({
    where: {
      propertyId,
      agentId,
      status: { in: LIVE_FIXATION_STATUSES as unknown as any },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createFixation(input: CreateFixationInput) {
  const property = await prisma.crmProperty.findUnique({
    where: { id: input.propertyId },
    select: { id: true, status: true, funnelStage: true },
  });
  if (!property) {
    throw new FixationError('Объект не найден', 'PROPERTY_NOT_FOUND', 404);
  }

  const agreement = await activeAgreementFor(input.propertyId);
  if (!agreement) {
    // Объект без договора вообще не должен быть виден, но проверяем и здесь:
    // гейт не может держаться на том, что список отфильтрован правильно.
    throw new FixationError(
      'У объекта нет действующего договора с собственником',
      'LISTING_AGREEMENT_REQUIRED',
      409,
    );
  }

  const buyer = await prisma.buyer.findUnique({
    where: { id: input.buyerId },
    select: { id: true, phone: true, brokerId: true },
  });
  if (!buyer) {
    throw new FixationError('Покупатель не найден', 'BUYER_NOT_FOUND', 404);
  }
  if (buyer.brokerId !== input.agentId) {
    // Фиксировать чужого покупателя нельзя: иначе фиксация перестаёт быть
    // доказательством того, кто привёл человека.
    throw new FixationError('Покупатель принадлежит другому агенту', 'BUYER_NOT_OWNED', 403);
  }

  const subscription = await getActiveSubscription(input.agencyId);
  if (!subscription) {
    throw new FixationError(
      'Нет действующей подписки на портал вторички',
      'MARKETPLACE_SUBSCRIPTION_REQUIRED',
      403,
    );
  }
  const live = await countLiveFixations(input.agencyId);
  if (live >= subscription.maxActiveFixations) {
    throw new FixationError(
      `Достигнут лимит тарифа: ${subscription.maxActiveFixations} активных фиксаций`,
      'FIXATION_LIMIT_REACHED',
      409,
    );
  }

  const identityHash = buyerIdentityHash(buyer.phone);

  const duplicate = await prisma.secondaryFixation.findFirst({
    where: {
      propertyId: input.propertyId,
      buyerIdentityHash: identityHash,
      status: { in: LIVE_FIXATION_STATUSES as unknown as any },
      expiresAt: { gt: new Date() },
    },
  });
  if (duplicate) {
    if (duplicate.agentId === input.agentId) {
      throw new FixationError(
        'Этот покупатель уже зафиксирован вами на этот объект',
        'ALREADY_FIXED_BY_YOU',
        409,
      );
    }
    throw new FixationError(
      'Этот покупатель уже закреплён за другим агентом по этому объекту',
      'REJECTED_DUPLICATE',
      409,
    );
  }

  const terms = termsForTier(agreement.tier);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + terms.fixationDays * DAY_MS);
  const protectionUntil = new Date(
    expiresAt.getTime() + agreement.protectionPeriodDays * DAY_MS,
  );

  return prisma.$transaction(async (tx) => {
    const fixation = await tx.secondaryFixation.create({
      data: {
        propertyId: input.propertyId,
        buyerId: input.buyerId,
        agentId: input.agentId,
        agencyId: input.agencyId === input.agentId ? null : input.agencyId,
        buyerIdentityHash: identityHash,
        // Условия фиксируются снимком: договор может быть перезаключён на
        // других условиях, а обещанное агенту вознаграждение — нет.
        declaredSharePercent: new Prisma.Decimal(agreement.buyerAgentSharePercent),
        status: 'CONFIRMED',
        sentAt: now,
        confirmedAt: now,
        expiresAt,
        protectionUntil,
      },
    });

    await tx.secondaryFixationStatusLog.create({
      data: {
        fixationId: fixation.id,
        fromStatus: null,
        toStatus: 'CONFIRMED',
        changedBy: input.agentId,
        note: 'Дубль-чек пройден, покупатель закреплён за агентом',
      },
    });

    return fixation;
  });
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ['SHOWN', 'CANCELLED', 'EXPIRED'],
  SHOWN: ['OFFER_MADE', 'CANCELLED', 'EXPIRED'],
  OFFER_MADE: ['DEAL', 'CANCELLED', 'EXPIRED'],
};

export async function advanceFixation(
  fixationId: string,
  toStatus: string,
  changedBy: string,
  note?: string,
) {
  const fixation = await prisma.secondaryFixation.findUnique({ where: { id: fixationId } });
  if (!fixation) throw new FixationError('Фиксация не найдена', 'NOT_FOUND', 404);

  const allowed = ALLOWED_TRANSITIONS[fixation.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new FixationError(
      `Переход ${fixation.status} → ${toStatus} не разрешён`,
      'INVALID_TRANSITION',
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.secondaryFixation.update({
      where: { id: fixationId },
      data: { status: toStatus as any },
    });
    await tx.secondaryFixationStatusLog.create({
      data: {
        fixationId,
        fromStatus: fixation.status,
        toStatus: toStatus as any,
        changedBy,
        note: note || null,
      },
    });
    return updated;
  });
}

/**
 * Ищет фиксацию, которая покрывает сделку с этим покупателем на этот объект.
 *
 * Ключевое отличие от `liveFixationFor`: здесь смотрим на `protectionUntil`,
 * а не на `expiresAt`. Именно это правило превращает «продали мимо нас через
 * месяц после истечения фиксации» из потери в основание для комиссии.
 */
export async function findCoveringFixation(
  propertyId: string,
  identityHash: string,
  at: Date = new Date(),
) {
  return prisma.secondaryFixation.findFirst({
    where: {
      propertyId,
      buyerIdentityHash: identityHash,
      status: { notIn: ['REJECTED_DUPLICATE', 'REJECTED_OTHER', 'CANCELLED'] },
      protectionUntil: { gte: at },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Помечает истёкшие фиксации. Идемпотентно — можно звать по расписанию. */
export async function expireStaleFixations(now: Date = new Date()): Promise<number> {
  const stale = await prisma.secondaryFixation.findMany({
    where: {
      status: { in: LIVE_FIXATION_STATUSES as unknown as any },
      expiresAt: { lt: now },
    },
    select: { id: true, status: true },
  });

  for (const fixation of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.secondaryFixation.update({
        where: { id: fixation.id },
        data: { status: 'EXPIRED' },
      });
      await tx.secondaryFixationStatusLog.create({
        data: {
          fixationId: fixation.id,
          fromStatus: fixation.status,
          toStatus: 'EXPIRED',
          note: 'Срок фиксации истёк; защитный период продолжает действовать',
        },
      });
    });
  }

  return stale.length;
}
