import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'ADMIN' };
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
  },
}));

const mockTx = {
  deal: { create: vi.fn() },
  crmProperty: { findUnique: vi.fn(), update: vi.fn() },
  property: { update: vi.fn() },
  commission: { create: vi.fn() },
};

import { dealsRouter } from '../routes/deals.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/deals', dealsRouter);
  return app;
}

const VALID_BODY = {
  amount: 36_000_000,
  commission: 500_000,
  casaFee: 100_000,
  objectType: 'PROPERTY',
  objectId: 'prop_1',
};

describe('POST /api/deals — objectType PROPERTY resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the CRM CrmProperty (not the legacy Property model) when the objectId is a CrmProperty', async () => {
    (mockTx.deal.create as any).mockResolvedValue({ id: 'deal_1', commission: 500000 });
    (mockTx.crmProperty.findUnique as any).mockResolvedValue({ id: 'prop_1' });

    const app = buildApp();
    const res = await request(app).post('/api/deals').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(mockTx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { status: 'SOLD' },
    });
    expect(mockTx.property.update).not.toHaveBeenCalled();
  });

  it('falls back to the legacy Property model when the objectId is not a CrmProperty', async () => {
    (mockTx.deal.create as any).mockResolvedValue({ id: 'deal_1', commission: 500000 });
    (mockTx.crmProperty.findUnique as any).mockResolvedValue(null);
    (mockTx.property.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/deals').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(mockTx.property.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { status: 'SOLD' },
    });
  });

  it('rolls back the Deal (transaction throws) when the objectId matches neither model', async () => {
    (mockTx.deal.create as any).mockResolvedValue({ id: 'deal_1', commission: 500000 });
    (mockTx.crmProperty.findUnique as any).mockResolvedValue(null);
    (mockTx.property.update as any).mockRejectedValue(new Error('Record not found'));

    const app = buildApp();
    const res = await request(app).post('/api/deals').send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});
