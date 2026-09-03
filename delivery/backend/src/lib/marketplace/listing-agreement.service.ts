/**
 * Договор с собственником — гейт публикации.
 *
 * Главное здесь не документооборот, а момент возникновения обязательства.
 * Комиссия должна становиться обязательством СОБСТВЕННИКА В МОМЕНТ
 * ПУБЛИКАЦИИ, а не в момент сделки. Иначе обход площадки — это просто
 * нечестность, с которой ничего не сделать; а так это нарушение принятых
 * условий, на которое есть защитный период и сверка при снятии объекта.
 */

import { Prisma } from '@prisma/client';
import type { ListingTier } from '@prisma/client';
import { prisma } from '../prisma';
import { termsForTier } from './tiers';

export class ListingAgreementError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'ListingAgreementError';
  }
}

/** Действующий договор объекта, если он есть. */
export async function activeAgreementFor(propertyId: string) {
  return prisma.listingAgreement.findFirst({
    where: { propertyId, status: 'ACTIVE' },
    orderBy: { acceptedAt: 'desc' },
  });
}

/**
 * Публикация без действующего договора невозможна. Отдельная функция, а не
 * inline-проверка: гейт вызывается из нескольких мест и должен звучать
 * одинаково везде.
 */
export async function assertPublishable(propertyId: string) {
  const agreement = await activeAgreementFor(propertyId);
  if (!agreement) {
    throw new ListingAgreementError(
      'Объект нельзя опубликовать без действующего договора с собственником',
      'LISTING_AGREEMENT_REQUIRED',
      409,
    );
  }
  if (agreement.expiresAt && agreement.expiresAt.getTime() < Date.now()) {
    throw new ListingAgreementError(
      'Договор с собственником истёк',
      'LISTING_AGREEMENT_EXPIRED',
      409,
    );
  }
  return agreement;
}

export interface CreateAgreementInput {
  propertyId: string;
  sellerId: string;
  tier: ListingTier;
  /** Переопределения условий админом. Пустые — берутся умолчания тарифа. */
  commissionPercent?: string;
  buyerAgentSharePercent?: string;
  protectionPeriodDays?: number;
  expiresAt?: Date | null;
}

export async function createAgreement(input: CreateAgreementInput) {
  const defaults = termsForTier(input.tier);

  const existing = await activeAgreementFor(input.propertyId);
  if (existing) {
    throw new ListingAgreementError(
      'У объекта уже есть действующий договор',
      'LISTING_AGREEMENT_EXISTS',
      409,
    );
  }

  return prisma.listingAgreement.create({
    data: {
      propertyId: input.propertyId,
      sellerId: input.sellerId,
      tier: input.tier,
      commissionPercent: new Prisma.Decimal(input.commissionPercent ?? defaults.commissionPercent),
      buyerAgentSharePercent: new Prisma.Decimal(
        input.buyerAgentSharePercent ?? defaults.buyerAgentSharePercent,
      ),
      protectionPeriodDays: input.protectionPeriodDays ?? defaults.protectionPeriodDays,
      expiresAt: input.expiresAt ?? null,
      status: 'DRAFT',
    },
  });
}

/**
 * Принятие условий собственником. Только отсюда договор становится ACTIVE —
 * поставить ACTIVE запросом нельзя, иначе «принятие» перестаёт быть фактом.
 */
export async function acceptAgreement(agreementId: string, evidence: string) {
  if (!evidence || evidence.trim().length < 3) {
    throw new ListingAgreementError(
      'Нужно указать, чем подтверждается принятие условий',
      'ACCEPTANCE_EVIDENCE_REQUIRED',
    );
  }

  const agreement = await prisma.listingAgreement.findUnique({ where: { id: agreementId } });
  if (!agreement) {
    throw new ListingAgreementError('Договор не найден', 'NOT_FOUND', 404);
  }
  if (agreement.status !== 'DRAFT') {
    throw new ListingAgreementError(
      `Принять можно только черновик договора, текущий статус: ${agreement.status}`,
      'INVALID_STATE',
      409,
    );
  }

  return prisma.listingAgreement.update({
    where: { id: agreementId },
    data: {
      status: 'ACTIVE',
      acceptedAt: new Date(),
      acceptanceEvidence: evidence.trim(),
    },
  });
}

export async function terminateAgreement(agreementId: string, reason: string) {
  return prisma.listingAgreement.update({
    where: { id: agreementId },
    data: {
      status: 'TERMINATED',
      terminatedAt: new Date(),
      terminationReason: reason || null,
    },
  });
}
