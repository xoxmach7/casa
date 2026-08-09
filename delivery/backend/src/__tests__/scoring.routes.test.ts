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
    client: { findUnique: vi.fn(), update: vi.fn() },
    clientScoring: { create: vi.fn(), findMany: vi.fn() },
    mortgageProgram: { findMany: vi.fn() },
    apartment: { findMany: vi.fn() },
  },
}));

vi.mock('../lib/scoring-document.service', () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue('mock pdf text'),
  extractCreditHistoryStatus: vi.fn().mockReturnValue({ status: 'GOOD', matchedPhrase: null }),
  extractAvgMonthlyPension: vi.fn().mockReturnValue({ averageAmount: 50_000, totalAmount: 150_000, matchesFound: 3 }),
  extractExistingMonthlyDebt: vi.fn().mockReturnValue({ averageAmount: 0, totalAmount: 0, matchesFound: 0 }),
}));

import { prisma } from '../lib/prisma';
import * as docService from '../lib/scoring-document.service';
import { scoringRouter } from '../routes/scoring.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/scoring', scoringRouter);
  return app;
}

describe('POST /api/scoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the client belongs to a different broker', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2', monthlyIncome: 500000 });

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    expect(res.status).toBe(403);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
  });

  it('reads uploaded documents, computes, saves the scoring, and returns matched programs', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1', monthlyIncome: 500000 });
    (prisma.clientScoring.create as any).mockResolvedValue({ id: 'scoring_1', scoreValue: 100 });
    (prisma.mortgageProgram.findMany as any).mockResolvedValue([
      { id: 'p1', bankName: 'Bank A', programName: 'Standard', interestRate: 12, maxTerm: 240 },
    ]);
    (prisma.apartment.findMany as any).mockResolvedValue([
      { id: 'apt_1', number: '5', floor: 2, rooms: 2, area: 55, price: 20000000, project: { id: 'proj_1', name: 'Prime Garden' } },
    ]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .field('downPayment', '5000000')
      .attach('creditHistoryFile', Buffer.from('%PDF-1.4 fake'), 'ki.pdf')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    expect(res.status).toBe(201);
    expect(docService.extractTextFromPdf).toHaveBeenCalledTimes(2);
    expect(prisma.clientScoring.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client_1',
          creditHistoryStatus: 'GOOD',
          avgMonthlyPension: 50_000,
          downPayment: 5_000_000,
          scoreValue: 100,
          approvalLikelihood: 'HIGH',
        }),
      })
    );
    expect(res.body.matchedPrograms).toBeDefined();
    expect(Array.isArray(res.body.matchedPrograms)).toBe(true);
    expect(res.body.matchedPrograms[0].suitability).toBeDefined();
    expect(res.body.suitableApartments).toHaveLength(1);
    expect(res.body.extraction).toEqual(
      expect.objectContaining({ creditHistoryDetected: true, pensionDetected: true })
    );
  });

  it('uses a broker-entered monthlyIncome over the client profile value, and saves it back to the client', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1', monthlyIncome: 200000 });
    (prisma.clientScoring.create as any).mockResolvedValue({ id: 'scoring_1', scoreValue: 80 });
    (prisma.mortgageProgram.findMany as any).mockResolvedValue([]);
    (prisma.apartment.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .field('monthlyIncome', '600000')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    expect(res.status).toBe(201);
    expect(res.body.resolvedMonthlyIncome).toBe(600000);
    expect(res.body.incomeSource).toBe('MANUAL');
    expect(prisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'client_1' }, data: { monthlyIncome: 600000 } })
    );
  });

  it('estimates income from ЕНПФ pension contributions when the client has none on file', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1', monthlyIncome: null });
    (prisma.clientScoring.create as any).mockResolvedValue({ id: 'scoring_1', scoreValue: 50 });
    (prisma.mortgageProgram.findMany as any).mockResolvedValue([]);
    (prisma.apartment.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    // mocked extractAvgMonthlyPension returns averageAmount: 50_000 → estimated income = 50_000 / 0.1
    expect(res.status).toBe(201);
    expect(res.body.resolvedMonthlyIncome).toBe(500000);
    expect(res.body.incomeSource).toBe('ESTIMATED_FROM_PENSION');
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it('400s when no clientId is provided', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    expect(res.status).toBe(400);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
  });

  it('400s when neither document is uploaded', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/scoring').field('clientId', 'client_1');

    expect(res.status).toBe(400);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
  });

  it('404s when the client does not exist', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .attach('pensionFile', Buffer.from('%PDF-1.4 fake'), 'pension.pdf');

    expect(res.status).toBe(404);
  });

  it('422s when an uploaded PDF cannot be parsed', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1', monthlyIncome: 500000 });
    (docService.extractTextFromPdf as any).mockRejectedValueOnce(new Error('bad pdf'));

    const app = buildApp();
    const res = await request(app)
      .post('/api/scoring')
      .field('clientId', 'client_1')
      .attach('creditHistoryFile', Buffer.from('not a pdf'), 'ki.pdf');

    expect(res.status).toBe(422);
    expect(prisma.clientScoring.create).not.toHaveBeenCalled();
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
