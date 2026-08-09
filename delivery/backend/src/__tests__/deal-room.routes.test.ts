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
    secondaryDeal: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    dealPrecheck: { create: vi.fn() },
    dealDeposit: { create: vi.fn(), update: vi.fn() },
    dealBooking: { create: vi.fn() },
    auditLog: { findMany: vi.fn() },
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
  });

  it('403s a broker on every route — the secondary-market contour is not theirs', async () => {
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    const app = buildApp();
    expect((await request(app).get('/api/deal-room')).status).toBe(403);
    expect((await request(app).post('/api/deal-room').send({ offerId: 'o1' })).status).toBe(403);
  });

  it('lets an analyst read the board but not move a deal', async () => {
    currentUser = { userId: 'analyst_1', role: 'ANALYST' };
    (prisma.secondaryDeal.count as any).mockResolvedValue(0);
    (prisma.secondaryDeal.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    expect((await request(app).get('/api/deal-room')).status).toBe(200);

    const transition = await request(app)
      .post('/api/deal-room/d1/transition')
      .send({ targetStage: 'GREEN_2', expectedVersion: 1 });
    expect(transition.status).toBe(403);
    expect(prisma.secondaryDeal.update).not.toHaveBeenCalled();
  });

  it('lets a coordinator open and move a deal', async () => {
    currentUser = { userId: 'coord_1', role: 'COORDINATOR' };
    (prisma.offer.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    // 404, not 403 — the role passed the guard and the handler ran.
    expect((await request(app).post('/api/deal-room').send({ offerId: 'missing' })).status).toBe(404);
  });
});

describe('GET /api/deal-room', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'coord_1', role: 'COORDINATOR' };
  });

  it('hides closed deals by default so the board shows work in progress', async () => {
    (prisma.secondaryDeal.count as any).mockResolvedValue(0);
    (prisma.secondaryDeal.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/deal-room');

    expect(res.status).toBe(200);
    expect(prisma.secondaryDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stage: { notIn: ['SOLD', 'FAILED'] } } })
    );
  });

  it('includes closed deals when asked', async () => {
    (prisma.secondaryDeal.count as any).mockResolvedValue(0);
    (prisma.secondaryDeal.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/deal-room?includeClosed=true');

    expect(prisma.secondaryDeal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('filters by an explicit stage instead of the default exclusion', async () => {
    (prisma.secondaryDeal.count as any).mockResolvedValue(1);
    (prisma.secondaryDeal.findMany as any).mockResolvedValue([{ id: 'd1', stage: 'SOLD' }]);

    const app = buildApp();
    const res = await request(app).get('/api/deal-room?stage=SOLD');

    expect(prisma.secondaryDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stage: 'SOLD' } })
    );
    expect(res.body.data).toHaveLength(1);
  });

  it('paginates and reports the total', async () => {
    (prisma.secondaryDeal.count as any).mockResolvedValue(45);
    (prisma.secondaryDeal.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/deal-room?page=3&limit=20');

    expect(res.body.meta).toEqual({ total: 45, page: 3, limit: 20, pages: 3 });
    expect(prisma.secondaryDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });

  it('400s on a limit above the cap rather than dumping the table', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/deal-room?limit=5000');
    expect(res.status).toBe(400);
    expect(prisma.secondaryDeal.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/deal-room/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'coord_1', role: 'COORDINATOR' };
  });

  it('404s an unknown deal', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue(null);
    const app = buildApp();
    expect((await request(app).get('/api/deal-room/nope')).status).toBe(404);
  });

  it('returns the deal with its history and the transitions the server would accept', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({
      id: 'd1',
      stage: 'GREEN_1',
      version: 4,
      risks: [],
    });
    (prisma.auditLog.findMany as any).mockResolvedValue([{ id: 'log_1', action: 'TRANSITION' }]);

    const app = buildApp();
    const res = await request(app).get('/api/deal-room/d1');

    expect(res.status).toBe(200);
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.meta.version).toBe(4);
    // From GREEN_1 the only forward move is GREEN_2 — never straight to booking.
    expect(res.body.meta.availableStages).toEqual(['GREEN_2', 'FAILED']);
  });

  it('offers no transitions out of a terminal stage', async () => {
    (prisma.secondaryDeal.findUnique as any).mockResolvedValue({ id: 'd2', stage: 'SOLD', version: 9, risks: [] });
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/deal-room/d2');

    expect(res.body.meta.availableStages).toEqual([]);
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
