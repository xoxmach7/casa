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
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    notification: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
  },
}));

const mockTx = {
  crmProperty: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
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
    funnelStage: 'CREATED',
    district: 'Бостандыкский',
    residentialComplex: 'Comfort City',
    publishedAt: null,
    customStageId: null,
    ...overrides,
  };
}

describe('PUT /api/crm-properties/:id/stage — auto-publish + notification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('auto-publishes the property when it moves into LEADS and was not published yet', async () => {
    const existing = buildExisting({ funnelStage: 'PREPARATION' });
    (prisma.crmProperty.findUnique as any).mockResolvedValue(existing);
    (mockTx.crmProperty.update as any).mockResolvedValue({ ...existing, funnelStage: 'LEADS' });
    (mockTx.crmProperty.findUniqueOrThrow as any).mockResolvedValue({ ...existing, funnelStage: 'LEADS' });

    const app = buildApp();
    const res = await request(app)
      .put('/api/crm-properties/prop_1/stage')
      .send({ funnelStage: 'LEADS' });

    expect(res.status).toBe(200);
    expect(mockTx.crmProperty.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prop_1' }, data: expect.objectContaining({ publishedAt: expect.any(Date) }) })
    );
    expect(mockTx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'broker_1' }) })
    );
  });

  it('does not re-publish when already published', async () => {
    const existing = buildExisting({ funnelStage: 'PREPARATION', publishedAt: new Date('2026-01-01') });
    (prisma.crmProperty.findUnique as any).mockResolvedValue(existing);
    (mockTx.crmProperty.update as any).mockResolvedValue({ ...existing, funnelStage: 'LEADS' });

    const app = buildApp();
    const res = await request(app)
      .put('/api/crm-properties/prop_1/stage')
      .send({ funnelStage: 'LEADS' });

    expect(res.status).toBe(200);
    expect(mockTx.crmProperty.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/crm-properties/:id/publish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes an unpublished property', async () => {
    const existing = buildExisting();
    (prisma.crmProperty.findUnique as any).mockResolvedValue(existing);
    (mockTx.crmProperty.findUniqueOrThrow as any).mockResolvedValue(existing);
    (mockTx.crmProperty.update as any).mockResolvedValue({ ...existing, publishedAt: new Date() });

    const app = buildApp();
    const res = await request(app).patch('/api/crm-properties/prop_1/publish').send({ publish: true });

    expect(res.status).toBe(200);
    expect(res.body.publishedAt).toBeTruthy();
  });

  it('unpublishes a published property', async () => {
    const existing = buildExisting({ publishedAt: new Date() });
    (prisma.crmProperty.findUnique as any).mockResolvedValue(existing);
    (mockTx.crmProperty.update as any).mockResolvedValue({ ...existing, publishedAt: null });

    const app = buildApp();
    const res = await request(app).patch('/api/crm-properties/prop_1/publish').send({ publish: false });

    expect(res.status).toBe(200);
    expect(res.body.publishedAt).toBeNull();
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).patch('/api/crm-properties/missing/publish').send({ publish: true });

    expect(res.status).toBe(404);
  });
});
