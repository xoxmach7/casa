import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    buyer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicBuyerLeadsRouter } from '../routes/public-buyer-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/buyer-leads', publicBuyerLeadsRouter);
  return app;
}

const VALID_BODY = {
  name: 'Ержан Абаев',
  phone: '+77009998877',
  district: 'Бостандыкский',
  rooms: [2, 3],
  minBudget: 25_000_000,
  maxBudget: 40_000_000,
};

describe('POST /api/public/buyer-leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/buyer-leads').send({ name: 'Ержан' });
    expect(res.status).toBe(400);
  });

  it('creates a new Buyer with preferences and assigns a broker', async () => {
    (prisma.buyer.findFirst as any).mockResolvedValue(null);
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'admin_001' });
    (prisma.buyer.create as any).mockResolvedValue({ id: 'buyer_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/buyer-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, buyerId: 'buyer_1' });

    expect(prisma.buyer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          brokerId: 'admin_001',
          firstName: 'Ержан',
          lastName: 'Абаев',
          phone: '+77009998877',
          minBudget: 25_000_000,
          maxBudget: 40_000_000,
          preferences: { district: 'Бостандыкский', rooms: [2, 3] },
          status: 'NEW',
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'admin_001' }) })
    );
  });

  it('updates an existing Buyer found by phone instead of creating a duplicate', async () => {
    (prisma.buyer.findFirst as any).mockResolvedValue({ id: 'buyer_existing', brokerId: 'broker_9' });
    (prisma.buyer.update as any).mockResolvedValue({ id: 'buyer_existing', brokerId: 'broker_9' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/buyer-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, buyerId: 'buyer_existing' });
    expect(prisma.buyer.create).not.toHaveBeenCalled();
    expect(prisma.buyer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'buyer_existing' },
        data: expect.objectContaining({ preferences: { district: 'Бостандыкский', rooms: [2, 3] } }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'broker_9' }) })
    );
  });

  it('500s when no broker is available for a new buyer', async () => {
    (prisma.buyer.findFirst as any).mockResolvedValue(null);
    (prisma.user.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/public/buyer-leads').send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(prisma.buyer.create).not.toHaveBeenCalled();
  });
});
