import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'BROKER' };
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    fixation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { fixationsRouter } from '../routes/fixations.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/fixations', fixationsRouter);
  return app;
}

describe('GET /api/fixations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the list to the requesting broker', async () => {
    (prisma.fixation.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/fixations');

    expect(prisma.fixation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brokerId: 'broker_1' } })
    );
  });
});

describe('POST /api/fixations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a DRAFT fixation owned by the requesting broker', async () => {
    (prisma.fixation.create as any).mockResolvedValue({ id: 'fix_1', status: 'DRAFT' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/fixations')
      .send({ clientId: 'client_1', projectId: 'proj_1' });

    expect(res.status).toBe(201);
    expect(prisma.fixation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: 'client_1', projectId: 'proj_1', brokerId: 'broker_1', status: 'DRAFT' }),
      })
    );
  });
});

describe('PATCH /api/fixations/:id/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows a valid transition (DRAFT -> SENT) and sets expiresAt 24 hours out', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue({ id: 'fix_1', brokerId: 'broker_1', status: 'DRAFT' });
    (prisma.fixation.update as any).mockResolvedValue({ id: 'fix_1', status: 'SENT' });

    const app = buildApp();
    const res = await request(app).patch('/api/fixations/fix_1/status').send({ status: 'SENT' });

    expect(res.status).toBe(200);
    const updateCall = (prisma.fixation.update as any).mock.calls[0][0];
    expect(updateCall.data.status).toBe('SENT');
    expect(updateCall.data.sentAt).toBeInstanceOf(Date);
    expect(updateCall.data.expiresAt).toBeInstanceOf(Date);
    const durationMs = updateCall.data.expiresAt.getTime() - updateCall.data.sentAt.getTime();
    expect(durationMs).toBe(24 * 60 * 60 * 1000);
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('rejects an invalid transition (DRAFT -> CONFIRMED)', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue({ id: 'fix_1', brokerId: 'broker_1', status: 'DRAFT' });

    const app = buildApp();
    const res = await request(app).patch('/api/fixations/fix_1/status').send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
    expect(prisma.fixation.update).not.toHaveBeenCalled();
  });

  it('records the rejection reason when moving to REJECTED_OTHER', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue({ id: 'fix_1', brokerId: 'broker_1', status: 'DUPLICATE_CHECK' });
    (prisma.fixation.update as any).mockResolvedValue({ id: 'fix_1', status: 'REJECTED_OTHER' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/fixations/fix_1/status')
      .send({ status: 'REJECTED_OTHER', reason: 'Объект снят с продажи' });

    expect(res.status).toBe(200);
    const updateCall = (prisma.fixation.update as any).mock.calls[0][0];
    expect(updateCall.data.rejectionReason).toBe('Объект снят с продажи');
  });

  it('403s when the fixation belongs to a different broker', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue({ id: 'fix_1', brokerId: 'broker_2', status: 'DRAFT' });

    const app = buildApp();
    const res = await request(app).patch('/api/fixations/fix_1/status').send({ status: 'SENT' });

    expect(res.status).toBe(403);
    expect(prisma.fixation.update).not.toHaveBeenCalled();
  });

  it('404s when the fixation does not exist', async () => {
    (prisma.fixation.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).patch('/api/fixations/missing/status').send({ status: 'SENT' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/fixations — payment fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts paymentMethod and dealAmount', async () => {
    (prisma.fixation.create as any).mockResolvedValue({ id: 'fix_1', status: 'DRAFT' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/fixations')
      .send({ clientId: 'client_1', projectId: 'proj_1', apartmentId: 'apt_1', paymentMethod: 'FULL', dealAmount: 34986400 });

    expect(res.status).toBe(201);
    expect(prisma.fixation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentMethod: 'FULL', dealAmount: 34986400 }),
      })
    );
  });
});
