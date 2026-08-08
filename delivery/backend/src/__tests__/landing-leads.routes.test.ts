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
    landingLead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { landingLeadsRouter } from '../routes/landing-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/landing-leads', landingLeadsRouter);
  return app;
}

describe('GET /api/admin/landing-leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists all leads when no status filter is given', async () => {
    (prisma.landingLead.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/admin/landing-leads');

    expect(prisma.landingLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('accepts an explicit status filter', async () => {
    (prisma.landingLead.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/admin/landing-leads?status=NEW');

    expect(prisma.landingLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'NEW' } })
    );
  });
});

describe('PATCH /api/admin/landing-leads/:id/decision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a lead CONTACTED and stamps the reviewer', async () => {
    (prisma.landingLead.findUnique as any).mockResolvedValue({ id: 'lead_1' });
    (prisma.landingLead.update as any).mockResolvedValue({ id: 'lead_1', status: 'CONTACTED' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/admin/landing-leads/lead_1/decision')
      .send({ decision: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(prisma.landingLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead_1' },
        data: expect.objectContaining({ status: 'CONTACTED', reviewedById: 'admin_1' }),
      })
    );
  });

  it('404s when the lead does not exist', async () => {
    (prisma.landingLead.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .patch('/api/admin/landing-leads/missing/decision')
      .send({ decision: 'REJECTED' });

    expect(res.status).toBe(404);
    expect(prisma.landingLead.update).not.toHaveBeenCalled();
  });

  it('400s on an invalid decision value', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/admin/landing-leads/lead_1/decision')
      .send({ decision: 'MAYBE' });

    expect(res.status).toBe(400);
  });
});
