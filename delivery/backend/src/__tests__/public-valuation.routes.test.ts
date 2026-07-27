import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { publicValuationRouter } from '../routes/public-valuation.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/valuation', publicValuationRouter);
  return app;
}

describe('POST /api/public/valuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400s on missing fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/valuation').send({ district: 'Бостандыкский' });
    expect(res.status).toBe(400);
  });

  it('returns a price range when comparables exist', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([
      { price: 30_000_000, area: 60 },
      { price: 42_000_000, area: 60 },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/valuation')
      .send({ district: 'Бостандыкский', rooms: 2, area: 60 });

    expect(res.status).toBe(200);
    expect(res.body.comparablesCount).toBe(2);
    expect(res.body.marketValue).toBe(36_000_000);
    expect(res.body.urgentPrice).toBeLessThan(res.body.marketValue);
    expect(res.body.marketPrice).toBeLessThan(res.body.marketValue);
  });

  it('422s when there are no comparables in the district/room combination', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/valuation')
      .send({ district: 'Турксибский', rooms: 4, area: 90 });

    expect(res.status).toBe(422);
    expect(res.body.error).toBeTruthy();
  });
});
