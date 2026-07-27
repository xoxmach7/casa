import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    seller: { create: vi.fn() },
    crmProperty: { create: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockPrisma)),
  },
}));

// Re-declared here (rather than imported) because vi.mock's factory is hoisted
// above imports and cannot reference the `prisma` import it produces.
const mockPrisma = {
  seller: { create: vi.fn() },
  crmProperty: { create: vi.fn() },
};

import { prisma } from '../lib/prisma';
import { publicPropertyLeadsRouter } from '../routes/public-property-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/property-leads', publicPropertyLeadsRouter);
  return app;
}

const VALID_BODY = {
  district: 'Бостандыкский',
  residentialComplex: 'Comfort City',
  address: 'ул. Розыбакиева',
  houseNumber: '100',
  price: 36_000_000,
  negotiable: true,
  moveInReady: false,
  furnished: false,
  hasAppliances: false,
  rooms: 2,
  area: 60,
  contactName: 'Аружан',
  contactPhone: '+77001234567',
};

describe('POST /api/public/property-leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send({ district: 'Бостандыкский' });
    expect(res.status).toBe(400);
  });

  it('creates a Seller and a draft CrmProperty inside one transaction, assigns to an available admin, and returns sellerId', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'admin_001' });
    (mockPrisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (mockPrisma.crmProperty.create as any).mockResolvedValue({ id: 'crmprop_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, sellerId: 'seller_1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(mockPrisma.seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brokerId: 'admin_001',
          firstName: 'Аружан',
          phone: '+77001234567',
          funnelStage: 'CONTACT',
          source: 'Форма: Добавить квартиру',
        }),
      })
    );

    expect(mockPrisma.crmProperty.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          district: 'Бостандыкский',
          residentialComplex: 'Comfort City',
          rooms: 2,
          price: 36_000_000,
          funnelStage: 'CREATED',
          sellerId: 'seller_1',
          brokerId: 'admin_001',
        }),
      })
    );
  });

  it('rolls back the Seller if creating the CrmProperty inside the transaction fails', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'admin_001' });
    (mockPrisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (mockPrisma.crmProperty.create as any).mockRejectedValue(new Error('db error'));

    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send(VALID_BODY);

    // The route's $transaction mock here just forwards to the real functions
    // without real rollback semantics (that's Postgres's job) — this test
    // verifies the route treats a mid-transaction failure as a hard error
    // rather than reporting success, which is what the transactional
    // wrapping is for.
    expect(res.status).toBe(500);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
