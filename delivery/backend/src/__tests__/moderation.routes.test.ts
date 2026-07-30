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
    crmProperty: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { moderationRouter } from '../routes/moderation.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/moderation', moderationRouter);
  return app;
}

describe('GET /api/admin/moderation/properties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults to the MODERATION status queue', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/admin/moderation/properties');

    expect(prisma.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'MODERATION' } })
    );
  });

  it('accepts an explicit status filter', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/admin/moderation/properties?status=NEEDS_INFORMATION');

    expect(prisma.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'NEEDS_INFORMATION' } })
    );
  });
});

describe('PATCH /api/admin/moderation/properties/:id/decision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a property, moving it to ACTIVE and notifying the broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({
      id: 'prop_1',
      residentialComplex: 'Prime Garden',
      brokerId: 'broker_1',
    });
    (prisma.crmProperty.update as any).mockResolvedValue({ id: 'prop_1', status: 'ACTIVE' });

    const app = buildApp();
    const res = await request(app).patch('/api/admin/moderation/properties/prop_1/decision').send({ decision: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({ where: { id: 'prop_1' }, data: { status: 'ACTIVE' } });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'broker_1' }) })
    );
  });

  it('rejects a property with a reason, moving it to ARCHIVED', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({
      id: 'prop_1',
      residentialComplex: 'Prime Garden',
      brokerId: 'broker_1',
    });
    (prisma.crmProperty.update as any).mockResolvedValue({ id: 'prop_1', status: 'ARCHIVED' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/admin/moderation/properties/prop_1/decision')
      .send({ decision: 'REJECT', reason: 'Фото не соответствуют объекту' });

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({ where: { id: 'prop_1' }, data: { status: 'ARCHIVED' } });
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).patch('/api/admin/moderation/properties/missing/decision').send({ decision: 'APPROVE' });

    expect(res.status).toBe(404);
    expect(prisma.crmProperty.update).not.toHaveBeenCalled();
  });

  it('400s on an invalid decision value', async () => {
    const app = buildApp();
    const res = await request(app).patch('/api/admin/moderation/properties/prop_1/decision').send({ decision: 'MAYBE' });

    expect(res.status).toBe(400);
  });
});
