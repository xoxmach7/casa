import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'ADMIN' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/matching.service', () => ({
  matchBuyersToProperty: vi.fn().mockResolvedValue(0),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
  },
}));

const mockTx = {
  crmProperty: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn().mockResolvedValue({}) },
};

import { prisma } from '../lib/prisma';
import { crmPropertiesRouter } from '../routes/crm-properties.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/crm-properties', crmPropertiesRouter);
  return app;
}

function buildExisting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    brokerId: 'broker_1',
    funnelStage: 'LEADS',
    district: 'Бостандыкский',
    residentialComplex: 'Comfort City',
    publishedAt: new Date('2026-01-01'),
    customStageId: null,
    ...overrides,
  };
}

describe('DELETE /api/crm-properties/:id (soft delete / archive)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears publishedAt so an archived-but-still-LEADS property disappears from the public catalog', async () => {
    const existing = buildExisting();
    (prisma.crmProperty.findUnique as any).mockResolvedValue(existing);
    (prisma.crmProperty.update as any).mockResolvedValue({ ...existing, status: 'ARCHIVED', publishedAt: null });

    const app = buildApp();
    const res = await request(app).delete('/api/crm-properties/prop_1');

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { status: 'ARCHIVED', publishedAt: null },
    });
  });
});

describe('PUT /api/crm-properties/:id/stage — invalid funnelStage rejected', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on ARCHIVED, which is not a real PropertyFunnelStage enum value', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/crm-properties/prop_1/stage')
      .send({ funnelStage: 'ARCHIVED' });

    expect(res.status).toBe(400);
    expect(prisma.crmProperty.findUnique).not.toHaveBeenCalled();
  });
});
