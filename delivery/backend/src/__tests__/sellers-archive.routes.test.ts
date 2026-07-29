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

vi.mock('../lib/prisma', () => ({
  prisma: {
    seller: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
  },
}));

const mockTx = {
  crmProperty: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
  seller: { update: vi.fn().mockResolvedValue({}) },
};

import { prisma } from '../lib/prisma';
import { sellersRouter } from '../routes/sellers.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sellers', sellersRouter);
  return app;
}

describe('DELETE /api/sellers/:id (archive seller + properties)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears publishedAt on every property when bulk-archiving a seller', async () => {
    (prisma.seller.findUnique as any).mockResolvedValue({
      id: 'seller_1',
      brokerId: 'broker_1',
      properties: [],
    });

    const app = buildApp();
    const res = await request(app).delete('/api/sellers/seller_1');

    expect(res.status).toBe(200);
    expect(mockTx.crmProperty.updateMany).toHaveBeenCalledWith({
      where: { sellerId: 'seller_1' },
      data: { status: 'ARCHIVED', publishedAt: null },
    });
  });
});
