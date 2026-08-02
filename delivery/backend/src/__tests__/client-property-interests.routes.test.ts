import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

vi.mock('../lib/audit-log.service', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findUnique: vi.fn() },
    buyer: { findUnique: vi.fn() },
    clientPropertyInterest: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { clientPropertyInterestsRouter } from '../routes/client-property-interests.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/client-property-interests', clientPropertyInterestsRouter);
  return app;
}

describe('POST /api/client-property-interests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/client-property-interests')
      .send({ propertyId: 'missing', buyerId: 'buyer_1' });

    expect(res.status).toBe(404);
  });

  it('403s when the buyer belongs to a different broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.buyer.findUnique as any).mockResolvedValue({ id: 'buyer_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/client-property-interests')
      .send({ propertyId: 'p1', buyerId: 'buyer_1' });

    expect(res.status).toBe(403);
  });

  it('creates the interest scoped to the requesting broker', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.buyer.findUnique as any).mockResolvedValue({ id: 'buyer_1', brokerId: 'broker_1' });
    (prisma.clientPropertyInterest.create as any).mockResolvedValue({ id: 'interest_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/client-property-interests')
      .send({ propertyId: 'p1', buyerId: 'buyer_1' });

    expect(res.status).toBe(201);
    expect(prisma.clientPropertyInterest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ propertyId: 'p1', buyerId: 'buyer_1', brokerId: 'broker_1' }),
    });
  });
});

describe('POST /api/client-property-interests/:id/close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when the interest belongs to a different broker', async () => {
    (prisma.clientPropertyInterest.findUnique as any).mockResolvedValue({ id: 'i1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).post('/api/client-property-interests/i1/close');

    expect(res.status).toBe(403);
  });

  it('closes the interest for its own broker', async () => {
    (prisma.clientPropertyInterest.findUnique as any).mockResolvedValue({ id: 'i1', brokerId: 'broker_1' });
    (prisma.clientPropertyInterest.update as any).mockResolvedValue({ id: 'i1', status: 'CLOSED' });

    const app = buildApp();
    const res = await request(app).post('/api/client-property-interests/i1/close');

    expect(res.status).toBe(200);
    expect(prisma.clientPropertyInterest.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    });
  });
});
