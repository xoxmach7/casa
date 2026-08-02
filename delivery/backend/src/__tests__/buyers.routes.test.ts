import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'BROKER' };
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    buyer: { findUnique: vi.fn(), update: vi.fn() },
    crmProperty: { findUnique: vi.fn() },
    show: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    offer: { findMany: vi.fn() },
  },
}));

vi.mock('../services/deepseek.service', () => ({
  deepSeekService: { analyzeShowFeedbacks: vi.fn() },
}));

import { prisma } from '../lib/prisma';
import { buyersRouter } from '../routes/buyers.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/buyers', buyersRouter);
  return app;
}

describe('PUT /api/buyers/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the buyer belongs to a different broker', async () => {
    (prisma.buyer.findUnique as any).mockResolvedValue({ id: 'buyer_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).put('/api/buyers/buyer_1').send({ notes: 'hijacked' });

    expect(res.status).toBe(403);
    expect(prisma.buyer.update).not.toHaveBeenCalled();
  });

  it('404s when the buyer does not exist', async () => {
    (prisma.buyer.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).put('/api/buyers/missing').send({ notes: 'x' });

    expect(res.status).toBe(404);
  });

  it('allows the owning broker to update their own buyer', async () => {
    (prisma.buyer.findUnique as any).mockResolvedValue({ id: 'buyer_1', brokerId: 'broker_1' });
    (prisma.buyer.update as any).mockResolvedValue({ id: 'buyer_1', notes: 'updated' });

    const app = buildApp();
    const res = await request(app).put('/api/buyers/buyer_1').send({ notes: 'updated' });

    expect(res.status).toBe(200);
    expect(prisma.buyer.update).toHaveBeenCalledWith({ where: { id: 'buyer_1' }, data: { notes: 'updated' } });
  });
});

describe('GET /api/buyers/shows/:propertyId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the property belongs to a different broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).get('/api/buyers/shows/prop_1');

    expect(res.status).toBe(403);
    expect(prisma.show.findMany).not.toHaveBeenCalled();
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/buyers/shows/missing');

    expect(res.status).toBe(404);
  });

  it('returns shows for the owning broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ brokerId: 'broker_1' });
    (prisma.show.findMany as any).mockResolvedValue([{ id: 'show_1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/buyers/shows/prop_1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('PUT /api/buyers/shows/:id — canonical transition guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the show does not exist', async () => {
    (prisma.show.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).put('/api/buyers/shows/missing').send({ status: 'COMPLETED' });

    expect(res.status).toBe(404);
  });

  it('allows the legacy SCHEDULED -> COMPLETED transition (maps to CONFIRMED -> COMPLETED)', async () => {
    (prisma.show.findUnique as any).mockResolvedValue({ id: 'show_1', status: 'SCHEDULED', propertyId: 'prop_1' });
    (prisma.show.update as any).mockResolvedValue({ id: 'show_1', status: 'COMPLETED' });

    const app = buildApp();
    const res = await request(app).put('/api/buyers/shows/show_1').send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(prisma.show.update).toHaveBeenCalled();
  });

  it('409s an invalid transition out of a terminal legacy status', async () => {
    (prisma.show.findUnique as any).mockResolvedValue({ id: 'show_1', status: 'CANCELLED', propertyId: 'prop_1' });

    const app = buildApp();
    const res = await request(app).put('/api/buyers/shows/show_1').send({ status: 'SCHEDULED' });

    expect(res.status).toBe(409);
    expect(prisma.show.update).not.toHaveBeenCalled();
  });

  it('allows updating feedback/rating without a status change regardless of current status', async () => {
    (prisma.show.findUnique as any).mockResolvedValue({ id: 'show_1', status: 'COMPLETED', propertyId: 'prop_1' });
    (prisma.show.update as any).mockResolvedValue({ id: 'show_1', status: 'COMPLETED', feedback: 'great' });

    const app = buildApp();
    const res = await request(app).put('/api/buyers/shows/show_1').send({ feedback: 'great', rating: 5 });

    expect(res.status).toBe(200);
    expect(prisma.show.update).toHaveBeenCalled();
  });
});

describe('GET /api/buyers/offers/:propertyId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the property belongs to a different broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).get('/api/buyers/offers/prop_1');

    expect(res.status).toBe(403);
    expect(prisma.offer.findMany).not.toHaveBeenCalled();
  });

  it('returns offers for the owning broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ brokerId: 'broker_1' });
    (prisma.offer.findMany as any).mockResolvedValue([{ id: 'offer_1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/buyers/offers/prop_1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
