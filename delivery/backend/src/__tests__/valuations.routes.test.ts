import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } = { userId: 'admin_1', role: 'ADMIN' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
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

vi.mock('../lib/audit-log.service', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findUnique: vi.fn() },
    valuation: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    valuationVersion: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    marketReference: { findFirst: vi.fn() },
    comparable: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import { valuationsRouter } from '../routes/valuations.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/valuations', valuationsRouter);
  return app;
}

describe('valuations.routes — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s a non-admin on every endpoint', async () => {
    const app = buildApp();
    const create = await request(app).post('/api/valuations').send({ propertyId: 'p1' });
    const calc = await request(app).post('/api/valuations/v1/calculate-preliminary');
    const comparable = await request(app).post('/api/valuations/v1/comparables').send({});
    const confirm = await request(app).post('/api/valuations/v1/confirm').send({});

    expect(create.status).toBe(403);
    expect(calc.status).toBe(403);
    expect(comparable.status).toBe(403);
    expect(confirm.status).toBe(403);
  });
});

describe('POST /api/valuations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/valuations').send({ propertyId: 'missing' });

    expect(res.status).toBe(404);
  });

  it('creates a valuation in SUBMITTED status', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.valuation.create as any).mockResolvedValue({ id: 'val_1', propertyId: 'p1', status: 'SUBMITTED', currentVersion: 0 });

    const app = buildApp();
    const res = await request(app).post('/api/valuations').send({ propertyId: 'p1' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SUBMITTED');
  });
});

describe('POST /api/valuations/:id/calculate-preliminary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('goes to manual_review_required when no market reference exists', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({
      id: 'val_1',
      currentVersion: 0,
      property: { area: 60, residentialComplex: 'complex_1', rooms: 2, district: 'esil' },
    });
    (prisma.marketReference.findFirst as any).mockResolvedValue(null);
    (prisma.valuationVersion.create as any).mockResolvedValue({ id: 'ver_1' });
    (prisma.valuation.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/calculate-preliminary');

    expect(res.status).toBe(200);
    expect(prisma.valuationVersion.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ preliminaryLow: expect.anything() }),
    });
    expect(prisma.valuation.update).toHaveBeenCalledWith({
      where: { id: 'val_1' },
      data: { status: 'MANUAL_REVIEW_REQUIRED', currentVersion: 1 },
    });
  });

  it('computes preliminary range when a market reference is found', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({
      id: 'val_1',
      currentVersion: 0,
      property: { area: 60, residentialComplex: 'complex_1', rooms: 2, district: 'esil' },
    });
    (prisma.marketReference.findFirst as any).mockResolvedValue({
      id: 'ref_1',
      basePricePerM2Low: 500000,
      basePricePerM2High: 550000,
    });
    (prisma.valuationVersion.create as any).mockResolvedValue({ id: 'ver_1' });
    (prisma.valuation.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/calculate-preliminary');

    expect(res.status).toBe(200);
    expect(prisma.valuationVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        preliminaryLow: 30_000_000,
        preliminaryHigh: 33_000_000,
        marketReferenceId: 'ref_1',
      }),
    });
    expect(prisma.valuation.update).toHaveBeenCalledWith({
      where: { id: 'val_1' },
      data: { status: 'PRELIMINARY_READY', currentVersion: 1 },
    });
  });
});

describe('POST /api/valuations/:id/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  const validBody = {
    confirmedLow: 29_000_000,
    confirmedHigh: 32_000_000,
    urgentLow: 27_000_000,
    urgentHigh: 28_000_000,
    recommendedLaunchPrice: 30_500_000,
    maxLaunchPrice: 33_000_000,
    liquidity: 'MEDIUM',
    confidence: 'MEDIUM',
    decision: 'ACCEPTED',
    reviewerReason: 'проверено 6 аналогов, диапазон подтверждён',
    expectedVersion: 1,
  };

  it('409s on version conflict', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({ id: 'val_1', currentVersion: 2 });

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/confirm').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('version_conflict');
  });

  it('422s when fewer than 3 comparables are included and no manual override', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({ id: 'val_1', currentVersion: 1 });
    (prisma.valuationVersion.findUnique as any).mockResolvedValue({
      id: 'ver_1',
      isImmutable: false,
      comparables: [{ included: true }],
    });

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/confirm').send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('business_rule_failed');
  });

  it('confirms and marks the version immutable when enough comparables are included', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({ id: 'val_1', currentVersion: 1 });
    (prisma.valuationVersion.findUnique as any).mockResolvedValue({
      id: 'ver_1',
      isImmutable: false,
      comparables: [{ included: true }, { included: true }, { included: true }],
    });
    (prisma.valuationVersion.update as any).mockResolvedValue({ id: 'ver_1', isImmutable: true });
    (prisma.valuation.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/confirm').send(validBody);

    expect(res.status).toBe(200);
    expect(prisma.valuationVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver_1' },
      data: expect.objectContaining({ isImmutable: true, decision: 'ACCEPTED' }),
    });
    expect(prisma.valuation.update).toHaveBeenCalledWith({ where: { id: 'val_1' }, data: { status: 'ACCEPTED' } });
  });

  it('409s when the version is already immutable', async () => {
    (prisma.valuation.findUnique as any).mockResolvedValue({ id: 'val_1', currentVersion: 1 });
    (prisma.valuationVersion.findUnique as any).mockResolvedValue({
      id: 'ver_1',
      isImmutable: true,
      comparables: [],
    });

    const app = buildApp();
    const res = await request(app).post('/api/valuations/val_1/confirm').send(validBody);

    expect(res.status).toBe(409);
  });
});
