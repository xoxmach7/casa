/**
 * Кабинет собственника и снятие объекта.
 *
 * Здесь два узла, которые нельзя ослабить:
 *  — объект собственника не выходит в витрину сам собой: он создаётся в
 *    MODERATION, и опубликовать его без принятого договора нельзя;
 *  — снять объект можно только через опрос. Если не спросить «кому продано»,
 *    платформа никогда не узнает о сделке и комиссия не появится.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.MARKETPLACE_IDENTITY_HMAC_KEY = 'k'.repeat(40);

let currentUser: any = { userId: 'owner_1', role: 'OWNER' };

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
  seller: { findFirst: vi.fn() },
  crmProperty: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  listingAgreement: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  listingExit: { create: vi.fn() },
  secondaryFixation: { findFirst: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { marketplaceOwnerRouter } from '../routes/marketplace-owner.routes';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/marketplace/owner', marketplaceOwnerRouter);
  return instance;
}

const VALID_LISTING = {
  rooms: 3,
  residentialComplex: 'ЖК Северное сияние',
  district: 'Есильский',
  address: 'ул. Достык, 12, кв. 45',
  area: 78.5,
  floor: 7,
  totalFloors: 12,
  yearBuilt: 2019,
  price: 30000000,
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'owner_1', role: 'OWNER' };
  p.seller.findFirst.mockResolvedValue({ id: 'seller_1', userId: 'owner_1' });
  p.crmProperty.create.mockImplementation(async ({ data }: any) => ({ id: 'prop_1', ...data }));
  p.crmProperty.findUnique.mockResolvedValue({
    id: 'prop_1',
    sellerId: 'seller_1',
    status: 'ACTIVE',
    seller: { userId: 'owner_1' },
  });
  p.listingAgreement.findFirst.mockResolvedValue(null);
  p.secondaryFixation.findFirst.mockResolvedValue(null);
  p.$transaction.mockImplementation(async (fn: any) =>
    fn({
      listingExit: { create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'exit_1', ...data })) },
      crmProperty: { update: vi.fn() },
      listingAgreement: { updateMany: vi.fn() },
    }),
  );
});

describe('размещение объекта', () => {
  it('создаётся в MODERATION, а не сразу в витрине', async () => {
    const res = await request(app()).post('/api/marketplace/owner/listings').send(VALID_LISTING);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('MODERATION');
    expect(res.body.listingSource).toBe('OWNER_SELF');
    expect(res.body.funnelStage).toBe('CREATED');
  });

  it('привязывается к карточке продавца текущего собственника', async () => {
    await request(app()).post('/api/marketplace/owner/listings').send(VALID_LISTING);

    expect(p.crmProperty.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sellerId: 'seller_1' }) }),
    );
  });

  it('неполные данные отвергаются с разбором полей', async () => {
    const res = await request(app())
      .post('/api/marketplace/owner/listings')
      .send({ ...VALID_LISTING, price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
    expect(p.crmProperty.create).not.toHaveBeenCalled();
  });

  it('агент сюда не заходит вовсе', async () => {
    currentUser = { userId: 'agent_1', role: 'BROKER' };

    const res = await request(app()).post('/api/marketplace/owner/listings').send(VALID_LISTING);

    expect(res.status).toBe(403);
  });
});

describe('чужой объект', () => {
  it('отвечает 404, а не 403 — существование чужого объекта не подтверждается', async () => {
    p.crmProperty.findUnique.mockResolvedValue({
      id: 'prop_2',
      sellerId: 'seller_2',
      seller: { userId: 'owner_2' },
    });

    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_2/agreement')
      .send({ tier: 'BASIC' });

    expect(res.status).toBe(404);
    expect(p.listingAgreement.create).not.toHaveBeenCalled();
  });
});

describe('договор', () => {
  it('создаётся черновиком: ACTIVE ставится только принятием', async () => {
    p.listingAgreement.create.mockImplementation(async ({ data }: any) => ({ id: 'agr_1', ...data }));

    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/agreement')
      .send({ tier: 'EXCLUSIVE' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
  });

  it('уровень договора должен быть одним из двух', async () => {
    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/agreement')
      .send({ tier: 'ЛЮБОЙ' });

    expect(res.status).toBe(400);
    expect(p.listingAgreement.create).not.toHaveBeenCalled();
  });

  it('второй договор на объект с действующим не создаётся', async () => {
    p.listingAgreement.findFirst.mockResolvedValue({ id: 'agr_existing', status: 'ACTIVE' });

    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/agreement')
      .send({ tier: 'BASIC' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LISTING_AGREEMENT_EXISTS');
  });
});

describe('снятие объекта', () => {
  it('продан — но без телефона покупателя сверять нечего', async () => {
    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/exit')
      .send({ outcome: 'SOLD_OUTSIDE' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BUYER_PHONE_REQUIRED');
  });

  it('снятие без продажи телефона не требует', async () => {
    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/exit')
      .send({ outcome: 'WITHDRAWN' });

    expect(res.status).toBe(201);
    expect(res.body.exit.outcome).toBe('WITHDRAWN');
  });

  it('«продал сам» тому, кого привёл агент, открывает спор', async () => {
    // Фиксация в защитном периоде на этого же покупателя.
    p.secondaryFixation.findFirst.mockResolvedValue({ id: 'fix_1', agentId: 'agent_1' });

    let created: any;
    p.$transaction.mockImplementation(async (fn: any) =>
      fn({
        listingExit: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            created = data;
            return { id: 'exit_1', ...data };
          }),
        },
        crmProperty: { update: vi.fn() },
        listingAgreement: { updateMany: vi.fn() },
      }),
    );

    const res = await request(app())
      .post('/api/marketplace/owner/listings/prop_1/exit')
      .send({ outcome: 'SOLD_OUTSIDE', buyerPhone: '+77771234567', declaredPrice: '29000000' });

    expect(res.status).toBe(201);
    expect(created.disputeOpened).toBe(true);
    expect(created.matchedFixationId).toBe('fix_1');
  });

  it('«продал сам» постороннему спора не открывает', async () => {
    p.secondaryFixation.findFirst.mockResolvedValue(null);

    let created: any;
    p.$transaction.mockImplementation(async (fn: any) =>
      fn({
        listingExit: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            created = data;
            return { id: 'exit_1', ...data };
          }),
        },
        crmProperty: { update: vi.fn() },
        listingAgreement: { updateMany: vi.fn() },
      }),
    );

    await request(app())
      .post('/api/marketplace/owner/listings/prop_1/exit')
      .send({ outcome: 'SOLD_OUTSIDE', buyerPhone: '+77779998877' });

    expect(created.disputeOpened).toBe(false);
  });

  it('телефон покупателя не сохраняется в открытом виде', async () => {
    let created: any;
    p.$transaction.mockImplementation(async (fn: any) =>
      fn({
        listingExit: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            created = data;
            return { id: 'exit_1', ...data };
          }),
        },
        crmProperty: { update: vi.fn() },
        listingAgreement: { updateMany: vi.fn() },
      }),
    );

    await request(app())
      .post('/api/marketplace/owner/listings/prop_1/exit')
      .send({ outcome: 'SOLD_VIA_PLATFORM', buyerPhone: '+77771234567' });

    expect(created.buyerIdentityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(created)).not.toContain('7771234567');
  });
});
