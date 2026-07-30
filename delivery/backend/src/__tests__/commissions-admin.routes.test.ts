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
    commission: { findUnique: vi.fn(), update: vi.fn() },
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

describe('PATCH /api/commissions/:id/status as ADMIN', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs the transition and updates status', async () => {
    (prisma.commission.findUnique as any).mockResolvedValue({ id: 'comm_1', status: 'ESTIMATED' });
    (prisma.commission.update as any).mockResolvedValue({ id: 'comm_1', status: 'CONFIRMED' });

    const app = buildApp();
    const res = await request(app).patch('/api/commissions/comm_1/status').send({ status: 'CONFIRMED', note: 'ок' });

    expect(res.status).toBe(200);
    expect(prisma.commission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          statusHistory: { create: { fromStatus: 'ESTIMATED', toStatus: 'CONFIRMED', changedBy: 'admin_1', note: 'ок' } },
        }),
      })
    );
  });

  it('404s when the commission does not exist', async () => {
    (prisma.commission.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).patch('/api/commissions/missing/status').send({ status: 'PAID' });

    expect(res.status).toBe(404);
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });
});
