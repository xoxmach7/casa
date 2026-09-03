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
    commission: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { commissionsRouter } from '../routes/commissions.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/commissions', commissionsRouter);
  return app;
}

describe('GET /api/commissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the list to the requesting agent for restricted roles', async () => {
    (prisma.commission.findMany as any).mockResolvedValue([]);
    (prisma.commission.count as any).mockResolvedValue(0);

    const app = buildApp();
    await request(app).get('/api/commissions');

    // Комиссия бывает двух видов: по сделке новостройки (своя определяется
    // брокером сделки) и по сделке вторички (агентом, приведшим покупателя).
    // Агент должен видеть обе свои, поэтому выборка идёт по OR.
    expect(prisma.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ deal: { brokerId: 'broker_1' } }, { partnerAgentId: 'broker_1' }],
        },
      })
    );
  });
});

describe('GET /api/commissions/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the underlying deal belongs to a different broker', async () => {
    (prisma.commission.findUnique as any).mockResolvedValue({
      id: 'comm_1',
      deal: { id: 'deal_1', brokerId: 'broker_2' },
      partnerAgentId: null,
    });

    const app = buildApp();
    const res = await request(app).get('/api/commissions/comm_1');

    expect(res.status).toBe(403);
  });

  it('403s on a secondary-market commission earned by another agent', async () => {
    // У комиссии вторички deal = null. Если бы код читал deal.brokerId
    // напрямую, здесь была бы не проверка прав, а падение на undefined.
    (prisma.commission.findUnique as any).mockResolvedValue({
      id: 'comm_2',
      deal: null,
      secondaryDeal: { id: 'sdeal_1' },
      partnerAgentId: 'broker_2',
    });

    const app = buildApp();
    const res = await request(app).get('/api/commissions/comm_2');

    expect(res.status).toBe(403);
  });

  it('отдаёт комиссию вторички агенту, который привёл покупателя', async () => {
    (prisma.commission.findUnique as any).mockResolvedValue({
      id: 'comm_3',
      deal: null,
      secondaryDeal: { id: 'sdeal_1', finalPrice: '30000000.00' },
      partnerAgentId: 'broker_1',
      statusHistory: [{ toStatus: 'CONFIRMED' }],
    });

    const app = buildApp();
    const res = await request(app).get('/api/commissions/comm_3');

    expect(res.status).toBe(200);
    expect(res.body.secondaryDeal.id).toBe('sdeal_1');
  });

  it('returns the commission with its status history', async () => {
    (prisma.commission.findUnique as any).mockResolvedValue({
      id: 'comm_1',
      status: 'ESTIMATED',
      deal: { id: 'deal_1', brokerId: 'broker_1' },
      statusHistory: [{ toStatus: 'ESTIMATED' }],
    });

    const app = buildApp();
    const res = await request(app).get('/api/commissions/comm_1');

    expect(res.status).toBe(200);
    expect(res.body.statusHistory).toHaveLength(1);
  });
});

describe('PATCH /api/commissions/:id/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s for a BROKER (financial status changes are ADMIN-only)', async () => {
    const app = buildApp();
    const res = await request(app).patch('/api/commissions/comm_1/status').send({ status: 'PAID' });

    expect(res.status).toBe(403);
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });
});
