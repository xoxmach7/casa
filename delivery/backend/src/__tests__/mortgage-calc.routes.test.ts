import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = currentUser; next(); },
}));

const txMock = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn() },
  mortgageIdempotencyRecord: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
  mortgageCalculationRun: { create: vi.fn(), findUnique: vi.fn() },
  mortgageCalculationSnapshot: { create: vi.fn(), findUnique: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { ...txMock, $transaction: vi.fn(async (cb: any) => cb(txMock)) },
}));

import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/cases', mortgageCasesRouter);
  return i;
}

const theCase = { id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 1 };
const goldenBody = { target_price_max: 30000000, available_now_total: 5000000, annual_nominal_rate_percent: 12.5, term_months: 240 };

describe('M06 calculation-runs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValue(null);
    txMock.mortgageCase.findUnique.mockResolvedValue(theCase);
    txMock.mortgageCalculationRun.create.mockResolvedValue({ id: 'run_1', caseId: 'case_1', status: 'COMPLETED', createdAt: new Date('2026-08-25T00:00:00Z') });
    txMock.mortgageCalculationSnapshot.create.mockImplementation(async ({ data }: any) => ({ id: 'snap_1', ...data, createdAt: new Date('2026-08-25T00:00:00Z') }));
    txMock.mortgageAuditEvent.create.mockResolvedValue({});
    txMock.mortgageIdempotencyRecord.create.mockResolvedValue({});
  });

  it('POST без Idempotency-Key → 400', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/calculation-runs').send(goldenBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('idempotency_key_required');
  });

  it('POST golden → 201, персистит корректный расчёт (25M / 284035.14) в снапшот', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-golden-1')
      .send(goldenBody);
    expect(res.status).toBe(201);
    // реальный расчёт прошёл и попал в снапшот
    const snapArg = txMock.mortgageCalculationSnapshot.create.mock.calls[0][0].data;
    expect(snapArg.resultsJson.requiredFinancing.value).toBe('25000000.00');
    expect(snapArg.resultsJson.annuity.value).toBe('284035.14');
    expect(snapArg.status).toBe('COMPLETED');
    expect(snapArg.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapArg.outputHash).toMatch(/^[0-9a-f]{64}$/);
    // аудит записан (hash, без PII)
    expect(txMock.mortgageAuditEvent.create).toHaveBeenCalled();
    expect(res.body.data.results.annuity.value).toBe('284035.14');
  });

  it('POST по недоступному кейсу → 404 (object-level authz)', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app())
      .post('/api/v2/cases/case_x/calculation-runs')
      .set('Idempotency-Key', 'k2').send(goldenBody);
    expect(res.status).toBe(404);
  });

  it('POST с UNKNOWN входом → 201, статус BLOCKED, значения null', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-blocked')
      .send({ ...goldenBody, target_price_max: null, input_statuses: { target_price_max: 'MISSING' } });
    expect(res.status).toBe(201);
    const snapArg = txMock.mortgageCalculationSnapshot.create.mock.calls[0][0].data;
    expect(snapArg.status).toBe('BLOCKED');
    expect(snapArg.resultsJson.requiredFinancing.value).toBeNull();
  });

  it('GET snapshot чужого кейса → 404', async () => {
    txMock.mortgageCalculationSnapshot.findUnique.mockResolvedValue({
      id: 'snap_1', caseId: 'case_1', runId: 'run_1', resultsJson: {}, status: 'COMPLETED',
      mortgageCase: { id: 'case_1', ownerId: 'other_broker' },
    });
    const res = await request(app()).get('/api/v2/cases/case_1/calculation-snapshots/snap_1');
    expect(res.status).toBe(404);
  });

  it('GET snapshot своего кейса → 200', async () => {
    txMock.mortgageCalculationSnapshot.findUnique.mockResolvedValue({
      id: 'snap_1', caseId: 'case_1', runId: 'run_1', engineVersion: 'M06/v1.4',
      decimalContextVersion: 'x', inputHash: 'a', outputHash: 'b',
      resultsJson: { status: 'COMPLETED' }, status: 'COMPLETED', createdAt: new Date(),
      mortgageCase: theCase,
    });
    const res = await request(app()).get('/api/v2/cases/case_1/calculation-snapshots/snap_1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('snap_1');
  });
});
