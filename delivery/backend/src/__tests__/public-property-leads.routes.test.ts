import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    seller: { create: vi.fn() },
    crmProperty: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

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

  it('creates a Seller and a draft CrmProperty, assigns to an available admin, and returns sellerId', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'admin_001' });
    (prisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (prisma.crmProperty.create as any).mockResolvedValue({ id: 'crmprop_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/property-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, sellerId: 'seller_1' });

    expect(prisma.seller.create).toHaveBeenCalledWith(
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

    expect(prisma.crmProperty.create).toHaveBeenCalledWith(
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
});
