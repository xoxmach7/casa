import type { Prisma, CrmProperty, Buyer } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

interface BuyerPreferences {
  district?: string;
  rooms?: number[];
}

function matchesPreferences(buyer: Buyer, property: CrmProperty): boolean {
  const price = Number(property.price);
  const minBudget = buyer.minBudget !== null ? Number(buyer.minBudget) : null;
  const maxBudget = buyer.maxBudget !== null ? Number(buyer.maxBudget) : null;
  if (minBudget !== null && price < minBudget) return false;
  if (maxBudget !== null && price > maxBudget) return false;

  const prefs = (buyer.preferences ?? {}) as BuyerPreferences;
  if (prefs.district && prefs.district !== property.district) return false;
  if (prefs.rooms && prefs.rooms.length > 0 && !prefs.rooms.includes(property.rooms)) return false;

  return true;
}

/**
 * Finds active buyers whose saved criteria (budget + preferences JSON) match
 * a newly published property, and notifies each buyer's broker in the CRM.
 * Returns the number of buyers matched.
 */
export async function matchBuyersToProperty(tx: TxClient, property: CrmProperty): Promise<number> {
  const candidates = await tx.buyer.findMany({
    where: { status: { in: ['NEW', 'ACTIVE'] } },
  });

  const matches = candidates.filter((buyer) => matchesPreferences(buyer, property));

  for (const buyer of matches) {
    await tx.notification.create({
      data: {
        userId: buyer.brokerId,
        type: 'SYSTEM',
        title: 'Новый объект по критериям покупателя',
        message: `Объект "${property.residentialComplex}" (${property.district}, ${property.rooms}-комн., ${Number(property.price).toLocaleString('ru-RU')} ₸) подходит покупателю ${buyer.firstName}.`,
        isRead: false,
      },
    });
  }

  return matches.length;
}
