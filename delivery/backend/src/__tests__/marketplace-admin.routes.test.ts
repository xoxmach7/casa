/**
 * Административный контур: гейт публикации и начисление комиссии.
 *
 * Самая важная проверка файла — объект нельзя вывести в витрину без
 * действующего договора, сколько бы раз модератор ни нажал «одобрить».
 * Именно здесь комиссия становится обязательством ДО того, как объект
 * увидели агенты.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: any = { userId: 'admin_1', role: 'ADMIN' };

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
  crmProperty: { update: vi.fn(), findMany: vi.fn() },
  listingAgreement: { findFirst: vi.fn() },
  agencySubscription: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  listingExit: { findMany: vi.fn() },
  commission: { findUnique: vi.fn() },
  secondaryDeal: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { marketplaceAdminRouter } from '../routes/marketplace-admin.routes';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/admin/marketplace', marketplaceAdminRouter);
  return instance;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'admin_1', role: 'ADMIN' };
  p.crmProperty.update.mockImplementation(async ({ data }: any) => ({ id: 'prop_1', ...data }));
  p.user.findUnique.mockResolvedValue({ id: 'agency_1' });
  p.$transaction.mockImplementation(async (fn: any) =>
    fn({
      agencySubscription: {
        updateMany: vi.fn(),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'sub_1', ...data })),
      },
    }),
  );
});

describe('гейт публикации', () => {
  it('без действующего договора объект не публикуется', async () => {
    p.listingAgreement.findFirst.mockResolvedValue(null);

    const res = await request(app()).post('/api/admin/marketplace/listings/prop_1/approve');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LISTING_AGREEMENT_REQUIRED');
    expect(p.crmProperty.update).not.toHaveBeenCalled();
  });

  it('истёкший договор публикацию тоже не открывает', async () => {
    p.listingAgreement.findFirst.mockResolvedValue({
      id: 'agr_1',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 86400000),
    });

    const res = await request(app()).post('/api/admin/marketplace/listings/prop_1/approve');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LISTING_AGREEMENT_EXPIRED');
  });

  it('с действующим договором объект выходит в витрину', async () => {
    p.listingAgreement.findFirst.mockResolvedValue({ id: 'agr_1', status: 'ACTIVE', expiresAt: null });

    const res = await request(app()).post('/api/admin/marketplace/listings/prop_1/approve');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.publishedAt).toBeTruthy();
  });

  it('агент в административный контур не заходит', async () => {
    currentUser = { userId: 'agent_1', role: 'BROKER' };

    const res = await request(app()).get('/api/admin/marketplace/disputes');

    expect(res.status).toBe(403);
  });
});

describe('подписки агентств', () => {
  it('выдача подписки гасит предыдущую активную', async () => {
    const updateMany = vi.fn();
    p.$transaction.mockImplementation(async (fn: any) =>
      fn({
        agencySubscription: {
          updateMany,
          create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'sub_1', ...data })),
        },
      }),
    );

    const res = await request(app())
      .post('/api/admin/marketplace/subscriptions')
      .send({ agencyId: 'agency_1', plan: 'PRO' });

    expect(res.status).toBe(201);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agencyId: 'agency_1', status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      }),
    );
  });

  it('лимиты берутся из тарифа, когда их не задали руками', async () => {
    let created: any;
    p.$transaction.mockImplementation(async (fn: any) =>
      fn({
        agencySubscription: {
          updateMany: vi.fn(),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            created = data;
            return { id: 'sub_1', ...data };
          }),
        },
      }),
    );

    await request(app())
      .post('/api/admin/marketplace/subscriptions')
      .send({ agencyId: 'agency_1', plan: 'START' });

    expect(created.maxActiveFixations).toBe(15);
    expect(created.maxAgents).toBe(5);
  });

  it('несуществующему агентству подписку не выдать', async () => {
    p.user.findUnique.mockResolvedValue(null);

    const res = await request(app())
      .post('/api/admin/marketplace/subscriptions')
      .send({ agencyId: 'nope', plan: 'PRO' });

    expect(res.status).toBe(404);
  });
});

describe('комиссия по сделке вторички', () => {
  it('не начисляется без итоговой цены', async () => {
    p.commission.findUnique.mockResolvedValue(null);
    p.secondaryDeal.findUnique.mockResolvedValue({
      id: 'sdeal_1',
      propertyId: 'prop_1',
      stage: 'SOLD',
      finalPrice: null,
      fixation: null,
    });

    const res = await request(app()).post('/api/admin/marketplace/deals/sdeal_1/commission');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('FINAL_PRICE_MISSING');
  });

  it('идемпотентна: повторный вызов не задваивает начисление', async () => {
    p.commission.findUnique.mockResolvedValue({ id: 'comm_1', amount: '450000' });

    const res = await request(app()).post('/api/admin/marketplace/deals/sdeal_1/commission');

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('comm_1');
    expect(p.secondaryDeal.findUnique).not.toHaveBeenCalled();
  });
});
