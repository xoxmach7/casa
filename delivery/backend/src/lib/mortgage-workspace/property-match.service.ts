/**
 * Подбор квартир под бюджет клиента.
 *
 * Бюджет = максимальный кредит из CASA-скоринга + первоначальный взнос.
 * Это ФИЛЬТР ПО ЦЕНЕ, а не обещание одобрения: показываем то, что клиент в
 * принципе может купить по нашей оценке, и ничего не говорим о решении банка.
 *
 * Источников два и они не смешиваются по смыслу:
 *  - новостройки: Apartment со статусом AVAILABLE в опубликованном ЖК;
 *  - вторичка: CrmProperty ровно по тем же условиям, что и публичная витрина
 *    (funnelStage LEADS + publishedAt + ACTIVE), чтобы брокер не увидел здесь
 *    объект, которого нет в каталоге.
 *
 * Нет бюджета (скоринг вернул NEEDS_DATA) — нет и подбора: пустой список с
 * причиной, а не «все квартиры подряд».
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export type PropertySource = 'NEW_BUILD' | 'SECONDARY';

export interface MatchedProperty {
  source: PropertySource;
  id: string;
  title: string;
  location: string;
  price: string;
  rooms: number;
  area: string;
  floor: number | null;
  url: string;
}

export interface MatchQuery {
  /** Верхняя граница цены: максимальный кредит + взнос. */
  budget: Prisma.Decimal;
  rooms?: number | null;
  limitPerSource?: number;
}

const DEFAULT_LIMIT = 6;

function money(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export async function findPropertiesWithinBudget(query: MatchQuery): Promise<MatchedProperty[]> {
  const take = query.limitPerSource ?? DEFAULT_LIMIT;
  const priceFilter = { lte: query.budget };
  const roomsFilter = query.rooms && query.rooms > 0 ? { rooms: query.rooms } : {};

  const [newBuilds, secondary] = await Promise.all([
    prisma.apartment.findMany({
      where: {
        price: priceFilter,
        status: 'AVAILABLE',
        project: { isPublished: true },
        ...roomsFilter,
      },
      orderBy: { price: 'desc' }, // ближе к верхней границе бюджета — интереснее клиенту
      take,
      select: {
        id: true, price: true, rooms: true, area: true, floor: true, number: true,
        project: { select: { id: true, name: true, city: true, district: true } },
      },
    }),
    prisma.crmProperty.findMany({
      where: {
        price: priceFilter,
        funnelStage: 'LEADS',
        publishedAt: { not: null },
        status: 'ACTIVE',
        ...roomsFilter,
      },
      orderBy: { price: 'desc' },
      take,
      select: {
        id: true, price: true, rooms: true, area: true, floor: true,
        residentialComplex: true, district: true, address: true,
      },
    }),
  ]);

  const fromNew: MatchedProperty[] = newBuilds.map((a) => ({
    source: 'NEW_BUILD',
    id: a.id,
    title: `${a.rooms}-комн., кв. ${a.number}`,
    location: [a.project?.name, a.project?.district, a.project?.city].filter(Boolean).join(', '),
    price: money(a.price),
    rooms: a.rooms,
    area: money(a.area),
    floor: a.floor,
    url: `/dashboard/projects/${a.project?.id ?? ''}/apartments`,
  }));

  const fromSecondary: MatchedProperty[] = secondary.map((p) => ({
    source: 'SECONDARY',
    id: p.id,
    title: `${p.rooms}-комн., ${money(p.area)} м²`,
    location: [p.residentialComplex, p.district, p.address].filter(Boolean).join(', '),
    price: money(p.price),
    rooms: p.rooms,
    area: money(p.area),
    floor: p.floor,
    url: `/dashboard/marketplace`,
  }));

  // Дороже — выше: клиенту показываем лучшее, что он тянет, а не самое дешёвое.
  return [...fromNew, ...fromSecondary]
    .sort((a, b) => Number(b.price) - Number(a.price));
}
