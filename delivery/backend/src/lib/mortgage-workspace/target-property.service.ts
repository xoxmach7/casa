/**
 * Квартира, под которую считается ипотека.
 *
 * Раньше цена в расчёте была числом, набранным руками: брокер смотрел карточку,
 * запоминал девять цифр и вводил их на другом экране. Опечатка ничем не
 * ловилась, а если застройщик менял цену — расчёт продолжал жить со старой.
 * Привязка убирает оба случая: цель покупки ссылается на объект каталога, и
 * цена ЧИТАЕТСЯ У ОБЪЕКТА в момент расчёта, а не хранится копией.
 *
 * Источника два — те же, что и в подборе квартир: новостройка (Apartment) и
 * вторичка (CrmProperty). Формат карточки совпадает с `MatchedProperty`, чтобы
 * привязанный объект и объект из подбора выглядели на экране одинаково.
 *
 * Доступность НЕ запрещает привязку: считать ипотеку по забронированной или
 * проданной квартире — законное действие брокера. Но объект помечается
 * `available: false`, чтобы экран сказал об этом прямо, а не молчал.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export type TargetSource = 'NEW_BUILD' | 'SECONDARY';

export interface TargetPropertyNode {
  source: TargetSource;
  id: string;
  title: string;
  location: string;
  /** Живая цена объекта на момент чтения, Decimal(15,2) строкой. */
  price: string;
  rooms: number;
  area: string;
  floor: number | null;
  /** Статус объекта в его собственном каталоге (AVAILABLE / ACTIVE / …). */
  status: string;
  available: boolean;
  /** Тип жилья для подбора программ: у банков это разные условия. */
  property_type: 'NEW_BUILDING' | 'SECONDARY';
  url: string;
}

function money(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Include для цели покупки: обе привязки со всем, что нужно карточке. */
export const targetPropertyInclude = {
  targetApartment: {
    select: {
      id: true, number: true, rooms: true, area: true, price: true, floor: true, status: true,
      project: { select: { id: true, name: true, city: true, district: true } },
    },
  },
  targetCrmProperty: {
    select: {
      id: true, rooms: true, area: true, price: true, floor: true, status: true,
      residentialComplex: true, district: true, address: true,
      listingAgreements: { where: { status: 'ACTIVE' as const }, select: { id: true }, take: 1 },
    },
  },
} as const;

type ApartmentRow = {
  id: string; number: string; rooms: number; area: Prisma.Decimal; price: Prisma.Decimal;
  floor: number; status: string;
  project: { id: string; name: string; city: string; district: string | null } | null;
};

type CrmRow = {
  id: string; rooms: number; area: Prisma.Decimal; price: Prisma.Decimal; floor: number;
  status: string; residentialComplex: string; district: string; address: string | null;
  listingAgreements: { id: string }[];
};

function fromApartment(a: ApartmentRow): TargetPropertyNode {
  return {
    source: 'NEW_BUILD',
    id: a.id,
    title: `${a.rooms}-комн., кв. ${a.number}`,
    location: [a.project?.name, a.project?.district, a.project?.city].filter(Boolean).join(', '),
    price: money(a.price),
    rooms: a.rooms,
    area: money(a.area),
    floor: a.floor,
    status: a.status,
    available: a.status === 'AVAILABLE',
    property_type: 'NEW_BUILDING',
    url: `/dashboard/projects/${a.project?.id ?? ''}/apartments`,
  };
}

function fromCrmProperty(p: CrmRow): TargetPropertyNode {
  return {
    source: 'SECONDARY',
    id: p.id,
    title: `${p.rooms}-комн., ${money(p.area)} м²`,
    location: [p.residentialComplex, p.district, p.address].filter(Boolean).join(', '),
    price: money(p.price),
    rooms: p.rooms,
    area: money(p.area),
    floor: p.floor,
    status: p.status,
    // Гейт площадки вторички: объект без действующего договора собственника для
    // агента не существует, поэтому «доступен» здесь значит и договор тоже.
    available: p.status === 'ACTIVE' && p.listingAgreements.length > 0,
    property_type: 'SECONDARY',
    url: '/dashboard/marketplace',
  };
}

/** Карточка привязанного объекта из уже загруженной цели покупки. */
export function targetPropertyNode(
  goal: { targetApartment?: ApartmentRow | null; targetCrmProperty?: CrmRow | null } | null,
): TargetPropertyNode | null {
  if (!goal) return null;
  if (goal.targetApartment) return fromApartment(goal.targetApartment);
  if (goal.targetCrmProperty) return fromCrmProperty(goal.targetCrmProperty);
  return null;
}

/**
 * Объект каталога по ссылке брокера. null — объекта нет: привязывать нечего,
 * и придумывать цену вместо него мы не будем.
 */
export async function loadTargetProperty(
  source: TargetSource,
  id: string,
): Promise<TargetPropertyNode | null> {
  if (source === 'NEW_BUILD') {
    const a = await prisma.apartment.findUnique({
      where: { id },
      select: targetPropertyInclude.targetApartment.select,
    });
    return a ? fromApartment(a as ApartmentRow) : null;
  }
  const p = await prisma.crmProperty.findUnique({
    where: { id },
    select: targetPropertyInclude.targetCrmProperty.select,
  });
  return p ? fromCrmProperty(p as CrmRow) : null;
}
