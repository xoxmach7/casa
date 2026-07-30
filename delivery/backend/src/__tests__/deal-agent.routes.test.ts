import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'admin_1', role: 'ADMIN' };
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
    deal: { findMany: vi.fn(), findUnique: vi.fn() },
    dealAgentAction: { findMany: vi.fn(), createMany: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { dealAgentRouter } from '../routes/deal-agent.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/deals/agent', dealAgentRouter);
  return app;
}

describe('POST /api/deals/agent/run', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks all in-progress deals and reports counts', async () => {
    const stageChangedAt = new Date('2026-07-01T00:00:00.000Z');
    (prisma.deal.findMany as any).mockResolvedValue([
      {
        id: 'deal_1',
        stage: 'CONSULTATION',
        stageChangedAt,
        notes: 'test',
        clientId: 'client_1',
        brokerId: 'broker_1',
      },
    ]);
    (prisma.dealAgentAction.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).post('/api/deals/agent/run');

    expect(res.status).toBe(200);
    expect(res.body.checkedDeals).toBe(1);
    expect(res.body.stalledCount).toBe(1);
    expect(prisma.dealAgentAction.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ dealId: 'deal_1', actionType: 'STALLED_ALERT' }),
        ]),
      })
    );
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it('does not re-alert a deal already logged since its last stage change', async () => {
    const stageChangedAt = new Date('2026-07-01T00:00:00.000Z');
    (prisma.deal.findMany as any).mockResolvedValue([
      {
        id: 'deal_1',
        stage: 'CONSULTATION',
        stageChangedAt,
        notes: 'test',
        clientId: 'client_1',
        brokerId: 'broker_1',
      },
    ]);
    (prisma.dealAgentAction.findMany as any).mockResolvedValue([
      { dealId: 'deal_1', actionType: 'STALLED_ALERT', createdAt: new Date('2026-07-15T00:00:00.000Z') },
      { dealId: 'deal_1', actionType: 'STAGE_SUGGESTED', createdAt: new Date('2026-07-15T00:00:00.000Z') },
    ]);

    const app = buildApp();
    const res = await request(app).post('/api/deals/agent/run');

    expect(res.status).toBe(200);
    expect(prisma.dealAgentAction.createMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/deals/agent/log/:dealId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the action log for a deal', async () => {
    (prisma.deal.findUnique as any).mockResolvedValue({ id: 'deal_1', brokerId: 'admin_1' });
    (prisma.dealAgentAction.findMany as any).mockResolvedValue([{ id: 'action_1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/deals/agent/log/deal_1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'action_1' }]);
  });

  it('404s when the deal does not exist', async () => {
    (prisma.deal.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/deals/agent/log/missing');

    expect(res.status).toBe(404);
  });
});
