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
    offer: { findUnique: vi.fn() },
    secondaryDeal: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    dealPrecheck: { create: vi.fn() },
    dealDeposit: { create: vi.fn(), update: vi.fn() },
    dealBooking: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { dealRoomRouter } from '../routes/deal-room.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/deal-room', dealRoomRouter);
  return app;
}

describe('deal-room.routes — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s a non-admin', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/deal-room').send({ offerId: 'o1' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/deal-room', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the offer does not exist', async () => {
    (prisma.offer.findUnique as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app).post('/api/deal-room').send({ offerId: 'missing' });
    expect(res.status).toBe(404);
  });

  it('is idempotent — returns the existing deal if the offer already opened one', async () => {
    (prisma.offer.findUnique as any).mockResolvedValue({
      id: 'o1', propertyId: 'p1', buyerId: 'b1', secondaryDeal: { id: 'deal_1' },
    });
    const app = buildApp();
    const res = await request(app).post('/api/deal-room').send({ offerId: 'o1' });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('deal_1');
    expect(prisma.secondaryDeal.create).not.toHaveBeenCalled();
  });

  it('409s when an active deal already exists for this property+buyer pair', async () => {
    (prisma.offer.findUnique as any).mockResolvedValue({ id: 'o2', propertyId: 'p1', buyerId: 'b1', secondaryDeal: null });
    (prisma.secondaryDeal.findFirst as any).mockResolvedValue({ id: 'deal_existing' });
    const app = buildApp();
    const res = await request(app).post('/api/deal-room').send({ offerId: 'o2' });
    expect(res.status).toBe(409);
  });

  it('opens a new deal room with precheck/deposit/booking scaffolding', async () => {
    (prisma.offer.findUnique as any).mockResolvedValue({ id: 'o3', propertyId: 'p1', buyerId: 'b1', secondaryDeal: null });
    (prisma.secondaryDeal.findFirst as any).mockResolvedValue(null);
    (prisma.secondaryDeal.create as any).mockResolvedValue({ id: 'deal_new', stage: 'OFFER_SUBMITTED' });
    (prisma.dealPrecheck.create as any).mockResolvedValue({});
    (prisma.dealDeposit.create as any).mockResolvedValue({});
    (prisma.dealBooking.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/deal-room').send({ offerId: 'o3' });

    expect(res.status).toBe(201);
    expect(prisma.dealPrecheck.create).toHaveBeenCalledWith({ data: { dealId: 'deal_new' } });
    expect(prisma.dealDeposit.create).toHaveBeenCalledWith({ data: { dealId: 'deal_new' } });
    expect(prisma.dealBooking.create).toHaveBeenCalledWith({ data: { dealId: 'deal_new' } });
  });
});

describe('POST /api/deal-room/:id/transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('409s on version conflict', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd1', stage: 'GREEN_1', version: 3 });
    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'GREEN_2', expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('version_conflict');
  });

  it('409s on an invalid transition (skipping Green gates)', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd1', stage: 'PRICE_AGREED', version: 1, risks: [] });
    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'BOOKING_ACTIVE', expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.blockers[0].code).toBe('invalid_transition');
  });

  it('422s Green 2 when precheck has an open blocking risk', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({
      id: 'd1',
      stage: 'GREEN_1',
      version: 1,
      risks: [],
      precheck: { hasBlockingRisk: true, paymentRouteConfirmed: true, missingAmount: 0, mortgagePartConfirmed: true },
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'GREEN_2', expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.blockers).toEqual(expect.arrayContaining([{ code: 'open_blocking_risk' }]));
  });

  it('applies a valid transition and bumps version', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({
      id: 'd1',
      stage: 'GREEN_1',
      version: 1,
      risks: [],
      precheck: { hasBlockingRisk: false, paymentRouteConfirmed: true, missingAmount: 0, mortgagePartConfirmed: true },
    });
    (prisma.secondaryDeal.update as any).mockResolvedValue({ id: 'd1', stage: 'GREEN_2', version: 2 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'GREEN_2', expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(prisma.secondaryDeal.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ stage: 'GREEN_2', version: { increment: 1 }, trafficLight: 'GREEN_2' }),
    });
  });

  it('400s sold/failed without a reason', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd1', stage: 'READY_FOR_NOTARY', version: 1, risks: [] });
    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'FAILED', expectedVersion: 1 });
    expect(res.status).toBe(400);
  });

  it('422s booking_active without coordinator-verified deposit transfer', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({
      id: 'd1',
      stage: 'DEPOSIT_TRANSFER_PENDING',
      version: 1,
      risks: [],
      deposit: { status: 'SIGNED', proofFileAssetId: null, coordinatorVerified: false },
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'BOOKING_ACTIVE', expectedVersion: 1 });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/deal-room/:id/deposit/verify-transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('409s when the deposit has not been signed yet', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd1', deposit: { id: 'dep_1', status: 'DRAFTING' } });
    const app = buildApp();
    const res = await request(app).post('/api/deal-room/d1/deposit/verify-transfer').send({
      proofType: 'bank_transfer',
      fileAssetId: 'file_1',
      coordinatorVerification: true,
      reason: 'confirmed by phone with bank statement screenshot',
    });
    expect(res.status).toBe(409);
  });

  it('verifies the transfer and marks the deposit coordinator-verified', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd1', deposit: { id: 'dep_1', status: 'SIGNED' } });
    (prisma.dealDeposit.update as any).mockResolvedValue({ id: 'dep_1', status: 'TRANSFER_PENDING', coordinatorVerified: true });

    const app = buildApp();
    const res = await request(app).post('/api/deal-room/d1/deposit/verify-transfer').send({
      proofType: 'bank_transfer',
      fileAssetId: 'file_1',
      coordinatorVerification: true,
      reason: 'confirmed by phone with bank statement screenshot',
    });

    expect(res.status).toBe(200);
    expect(prisma.dealDeposit.update).toHaveBeenCalledWith({
      where: { id: 'dep_1' },
      data: expect.objectContaining({ status: 'TRANSFER_PENDING', coordinatorVerified: true, proofFileAssetId: 'file_1' }),
    });
  });
});
