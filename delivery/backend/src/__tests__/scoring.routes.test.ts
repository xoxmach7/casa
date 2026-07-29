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
    client: { findUnique: vi.fn() },
    clientScoring: { create: vi.fn(), findMany: vi.fn() },
    mortgageProgram: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { scoringRouter } from '../routes/scoring.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/scoring', scoringRouter);
  return app;
}

const VALID_BODY = {
  clientId: 'client_1',
  creditHistoryStatus: 'GOOD',
  avgMonthlyPension: 50_000,
  existingMonthlyDebt: 0,
};

describe('POST /api/scoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the client belongs to a different broker', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2', monthlyIncome: 500000 });

    const app = buildApp();
    const res = await request(app).post('/api/scoring').send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
  });

  it('computes, saves the scoring, and returns matched programs', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1', monthlyIncome: 500000 });
    (prisma.clientScoring.create as any).mockResolvedValue({ id: 'scoring_1', scoreValue: 100 });
    (prisma.mortgageProgram.findMany as any).mockResolvedValue([
      { id: 'p1', bankName: 'Bank A', programName: 'Standard', interestRate: 12, maxTerm: 240 },
    ]);

    const app = buildApp();
    const res = await request(app).post('/api/scoring').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(prisma.clientScoring.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client_1',
          creditHistoryStatus: 'GOOD',
          scoreValue: 100,
          approvalLikelihood: 'HIGH',
        }),
      })
    );
    expect(res.body.matchedPrograms).toBeDefined();
    expect(Array.isArray(res.body.matchedPrograms)).toBe(true);
  });

  it('400s on an invalid creditHistoryStatus', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .send({ ...VALID_BODY, creditHistoryStatus: 'UNKNOWN' });

    expect(res.status).toBe(400);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
  });

  it('404s when the client does not exist', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/scoring').send(VALID_BODY);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/scoring/:clientId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns scoring history ordered by most recent first', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1' });
    (prisma.clientScoring.findMany as any).mockResolvedValue([{ id: 'scoring_2' }, { id: 'scoring_1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/scoring/client_1');

    expect(res.status).toBe(200);
    expect(prisma.clientScoring.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client_1' }, orderBy: { createdAt: 'desc' } })
    );
  });

  it('403s when a broker requests another broker\'s client history', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).get('/api/scoring/client_1');

    expect(res.status).toBe(403);
  });
});
