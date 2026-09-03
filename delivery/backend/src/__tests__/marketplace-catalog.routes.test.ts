/**
 * Витрина вторички: гейт подписки и маскировка на выходе.
 *
 * Два правила, которые здесь нельзя сломать незаметно:
 *  — без действующей подписки агент не видит витрину вообще (подписка это
 *    рычаг, которым собирается комиссия, а не строчка в биллинге);
 *  — объект без действующего договора с собственником для агента не
 *    существует, потому что комиссия по нему ничем не обеспечена.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: any = { userId: 'agent_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    },
}));

const p = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  agencySubscription: { findFirst: vi.fn() },
  secondaryFixation: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  crmProperty: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { marketplaceCatalogRouter } from '../routes/marketplace-catalog.routes';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/marketplace', marketplaceCatalogRouter);
  return instance;
}

const LISTING = {
  id: 'prop_1',
  residentialComplex: 'ЖК Северное сияние',
  district: 'Есильский',
  address: 'ул. Достык, 12, кв. 45',
  lat: 51.1284,
  lng: 71.4305,
  rooms: 3,
  area: 78.5,
  price: '30000000.00',
  images: [],
  krishaUrl: 'https://krisha.kz/a/show/1',
  listingAgreements: [
    { tier: 'BASIC', commissionPercent: '2.00', buyerAgentSharePercent: '50.00' },
  ],
};

function decimalish(value: string) {
  // Prisma отдаёт Decimal; в тестах достаточно объекта с теми же методами,
  // которые использует маршрут.
  const { Prisma } = require('@prisma/client');
  return new Prisma.Decimal(value);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'agent_1', role: 'BROKER' };
  p.user.findUnique.mockResolvedValue({ id: 'agent_1', role: 'BROKER', curatorId: 'agency_1' });
  p.agencySubscription.findFirst.mockResolvedValue({
    id: 'sub_1',
    agencyId: 'agency_1',
    status: 'ACTIVE',
    expiresAt: null,
    maxActiveFixations: 15,
  });
  p.secondaryFixation.findFirst.mockResolvedValue(null);
  p.secondaryFixation.count.mockResolvedValue(0);
  p.crmProperty.count.mockResolvedValue(1);
});

describe('гейт подписки', () => {
  it('без действующей подписки витрина закрыта', async () => {
    p.user.findUnique
      .mockResolvedValueOnce({ id: 'agent_1', role: 'BROKER', curatorId: null });
    p.agencySubscription.findFirst.mockResolvedValue(null);

    const res = await request(app()).get('/api/marketplace/listings');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MARKETPLACE_SUBSCRIPTION_REQUIRED');
    expect(p.crmProperty.findMany).not.toHaveBeenCalled();
  });

  it('истёкшая подписка не считается действующей, даже если статус ACTIVE', async () => {
    p.agencySubscription.findFirst.mockResolvedValue({
      id: 'sub_1',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 86400000),
      maxActiveFixations: 15,
    });

    const res = await request(app()).get('/api/marketplace/listings');

    expect(res.status).toBe(403);
  });

  it('сотрудник CASA заходит без подписки', async () => {
    currentUser = { userId: 'coord_1', role: 'COORDINATOR' };
    p.agencySubscription.findFirst.mockResolvedValue(null);
    p.crmProperty.findMany.mockResolvedValue([]);
    p.crmProperty.count.mockResolvedValue(0);

    const res = await request(app()).get('/api/marketplace/listings');

    expect(res.status).toBe(200);
  });
});

describe('выдача каталога', () => {
  beforeEach(() => {
    p.crmProperty.findMany.mockResolvedValue([
      {
        ...LISTING,
        price: decimalish('30000000.00'),
        listingAgreements: [
          {
            tier: 'BASIC',
            commissionPercent: decimalish('2.00'),
            buyerAgentSharePercent: decimalish('50.00'),
          },
        ],
      },
    ]);
  });

  it('берёт только объекты с действующим договором', async () => {
    await request(app()).get('/api/marketplace/listings');

    expect(p.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          listingAgreements: { some: { status: 'ACTIVE' } },
        }),
      }),
    );
  });

  it('без фиксации отдаёт объект маскированным', async () => {
    const res = await request(app()).get('/api/marketplace/listings');

    expect(res.status).toBe(200);
    const listing = res.body.listings[0];
    expect(listing.isMasked).toBe(true);
    expect(listing.address).toBeUndefined();
    expect(listing.lat).toBeNull();
    expect(JSON.stringify(listing)).not.toContain('krisha.kz');
  });

  it('показывает объявленный сплит и ожидаемое вознаграждение', async () => {
    const res = await request(app()).get('/api/marketplace/listings');

    const listing = res.body.listings[0];
    // 30 000 000 × 2% = 600 000; доля агента 50% = 300 000.
    expect(listing.declaredSharePercent).toBe('50');
    expect(listing.expectedReward).toBe('300000');
  });

  it('с живой фиксацией отдаёт объект целиком', async () => {
    p.secondaryFixation.findFirst.mockResolvedValue({
      id: 'fix_1',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app()).get('/api/marketplace/listings');

    const listing = res.body.listings[0];
    expect(listing.isMasked).toBe(false);
    expect(listing.address).toBe('ул. Достык, 12, кв. 45');
    expect(listing.fixation.id).toBe('fix_1');
  });
});

describe('остаток лимита', () => {
  it('показывает, сколько фиксаций ещё можно сделать по тарифу', async () => {
    p.secondaryFixation.count.mockResolvedValue(4);

    const res = await request(app()).get('/api/marketplace/subscription');

    expect(res.status).toBe(200);
    expect(res.body.liveFixations).toBe(4);
    expect(res.body.remainingFixations).toBe(11);
  });
});
