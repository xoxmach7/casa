import type { Prisma, CrmProperty } from '@prisma/client';
import { matchBuyersToProperty } from './matching.service';

type TxClient = Prisma.TransactionClient;

/**
 * Marks a CrmProperty as published (visible in the public catalog) if it
 * isn't already, then runs buyer matching against it. Idempotent: calling
 * this on an already-published property is a no-op.
 */
export async function publishProperty(tx: TxClient, propertyId: string): Promise<CrmProperty> {
  const existing = await tx.crmProperty.findUniqueOrThrow({ where: { id: propertyId } });
  if (existing.publishedAt) return existing;

  const published = await tx.crmProperty.update({
    where: { id: propertyId },
    data: { publishedAt: new Date() },
  });

  await matchBuyersToProperty(tx, published);

  return published;
}

export async function unpublishProperty(tx: TxClient, propertyId: string): Promise<CrmProperty> {
  return tx.crmProperty.update({
    where: { id: propertyId },
    data: { publishedAt: null },
  });
}
