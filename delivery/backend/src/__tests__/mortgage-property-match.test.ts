/**
 * Подбор квартир под бюджет клиента.
 *
 * Проверяется не «запрос ушёл», а обещания подбора:
 *  1) фильтр по цене реально применяется к обоим каталогам;
 *  2) каждый каталог берётся по правилам СВОЕГО раздела: новостройки — как
 *     их видит брокер, вторичка — по гейту площадки (договор собственника);
 *  3) новостройки и вторичка перемешаны и отсортированы по цене вниз —
 *     брокеру нужно лучшее, что клиент тянет, а не самое дешёвое.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const db = vi.hoisted(() => ({
  apartment: { findMany: vi.fn() },
  crmProperty: { findMany: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({ prisma: db }));

import { findPropertiesWithinBudget } from '../lib/mortgage-workspace/property-match.service';

const NEW_BUILD = {
  id: 'ap_1', price: new Prisma.Decimal('28000000'), rooms: 2,
  area: new Prisma.Decimal('62.40'), floor: 7, number: '54',
  project: { id: 'pr_1', name: 'Prime Garden', city: 'Астана', district: 'Есиль' },
};

const SECONDARY = {
  id: 'cp_1', price: new Prisma.Decimal('31000000'), rooms: 3,
  area: new Prisma.Decimal('78.10'), floor: 4,
  residentialComplex: 'Хайвил', district: 'Алматы', address: 'ул. Кабанбай батыра 45',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.apartment.findMany.mockResolvedValue([NEW_BUILD]);
  db.crmProperty.findMany.mockResolvedValue([SECONDARY]);
});

describe('подбор квартир под бюджет', () => {
  it('фильтрует оба каталога по верхней границе бюджета', async () => {
    const budget = new Prisma.Decimal('34176139.57');
    await findPropertiesWithinBudget({ budget });

    expect(db.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ price: { lte: budget } }) }),
    );
    expect(db.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ price: { lte: budget } }) }),
    );
  });

  it('новостройки: только свободные, БЕЗ фильтра публикации на сайте', async () => {
    await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000') });
    const where = db.apartment.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('AVAILABLE');
    // isPublished управляет публичным сайтом casa40, а не доступностью объекта
    // брокеру: раздел «Новостройки» им не фильтрует, значит и подбор не должен.
    expect(where.project).toBeUndefined();
  });

  it('вторичка берётся по гейту площадки: только с действующим договором', async () => {
    await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000') });
    const where = db.crmProperty.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    // Объект без договора собственника для агента не существует — подбор
    // не имеет права показать то, чего нет на площадке вторички.
    expect(where.listingAgreements).toEqual({ some: { status: 'ACTIVE' } });
    expect(where.funnelStage).toBeUndefined();
  });

  it('фильтр по комнатам применяется, когда задан', async () => {
    await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000'), rooms: 2 });
    expect(db.apartment.findMany.mock.calls[0][0].where.rooms).toBe(2);
    expect(db.crmProperty.findMany.mock.calls[0][0].where.rooms).toBe(2);
  });

  it('нулевые/пустые комнаты не превращаются в фильтр rooms: 0', async () => {
    await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000'), rooms: null });
    expect(db.apartment.findMany.mock.calls[0][0].where.rooms).toBeUndefined();
  });

  it('оба источника в одном списке, дороже — выше', async () => {
    const items = await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000') });
    expect(items).toHaveLength(2);
    expect(items[0].source).toBe('SECONDARY'); // 31 млн
    expect(items[1].source).toBe('NEW_BUILD'); // 28 млн
    expect(Number(items[0].price)).toBeGreaterThan(Number(items[1].price));
  });

  it('строка карточки читается брокером, а не собирается из кодов', async () => {
    const items = await findPropertiesWithinBudget({ budget: new Prisma.Decimal('50000000') });
    const newBuild = items.find((i) => i.source === 'NEW_BUILD')!;
    expect(newBuild.title).toBe('2-комн., кв. 54');
    expect(newBuild.location).toBe('Prime Garden, Есиль, Астана');
    expect(newBuild.price).toBe('28000000.00');
    expect(newBuild.url).toBe('/dashboard/projects/pr_1/apartments');
  });

  it('пустые каталоги — пустой список, без выдумок', async () => {
    db.apartment.findMany.mockResolvedValue([]);
    db.crmProperty.findMany.mockResolvedValue([]);
    const items = await findPropertiesWithinBudget({ budget: new Prisma.Decimal('1000000') });
    expect(items).toEqual([]);
  });
});
