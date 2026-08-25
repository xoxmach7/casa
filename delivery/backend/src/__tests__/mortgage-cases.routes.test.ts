import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

const txMock = vi.hoisted(() => ({
  client: { findUnique: vi.fn() },
  mortgageCase: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  mortgageCaseParty: { create: vi.fn() },
  mortgageIdempotencyRecord: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
  consentRevision: { findUnique: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    ...txMock,
    $transaction: vi.fn(async (callback: any) => callback(txMock)),
  },
}));

import { prisma } from '../lib/prisma';
import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';
import { mortgageRequestHash } from '../lib/mortgage-case.service';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v2/cases', mortgageCasesRouter);
  return instance;
}

const createdCase = {
  id: 'case_1',
  clientId: 'client_1',
  ownerId: 'broker_1',
  status: 'DRAFT',
  version: 1,
  createdAt: new Date('2026-08-24T00:00:00.000Z'),
  updatedAt: new Date('2026-08-24T00:00:00.000Z'),
};

describe('mortgage case API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValue(null);
    txMock.client.findUnique.mockResolvedValue({ id: 'client_1', brokerId: 'broker_1' });
    txMock.mortgageCase.create.mockResolvedValue(createdCase);
    txMock.mortgageCaseParty.create.mockResolvedValue({ id: 'party_1' });
    txMock.mortgageIdempotencyRecord.create.mockResolvedValue({});
    txMock.mortgageAuditEvent.create.mockResolvedValue({});
  });

  it('requires an idempotency key and validates create input', async () => {
    const missingKey = await request(app()).post('/api/v2/cases').send({ client_id: 'client_1' });
    const invalid = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'create-1')
      .send({ client_id: '' });

    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe('idempotency_key_required');
    expect(missingKey.body.error.trace_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
    expect(txMock.mortgageCase.create).not.toHaveBeenCalled();
  });

  it('does not let a broker create a case for another broker client', async () => {
    txMock.client.findUnique.mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const response = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'foreign-client')
      .send({ client_id: 'client_1' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('client_not_found');
    expect(txMock.mortgageCase.create).not.toHaveBeenCalled();
  });

  it('atomically creates a case, primary party, audit event and replay record', async () => {
    const response = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'create-1')
      .send({ client_id: 'client_1' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('case_1');
    expect(txMock.mortgageCase.create).toHaveBeenCalledWith({
      data: { clientId: 'client_1', ownerId: 'broker_1' },
    });
    expect(txMock.mortgageCaseParty.create).toHaveBeenCalledWith({
      data: { caseId: 'case_1', clientId: 'client_1', role: 'PRIMARY' },
    });
    expect(txMock.mortgageAuditEvent.create).toHaveBeenCalled();
    expect(txMock.mortgageIdempotencyRecord.create).toHaveBeenCalled();
  });

  it('replays an identical completed request and rejects a changed payload', async () => {
    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValueOnce({
      requestHash: mortgageRequestHash({ client_id: 'client_1' }),
      responseStatus: 201,
      responseBody: { data: { id: 'case_1' } },
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const replay = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'create-1')
      .send({ client_id: 'client_1' });

    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe('case_1');
    expect(txMock.mortgageCase.create).not.toHaveBeenCalled();

    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValueOnce({
      requestHash: 'different',
      responseStatus: 201,
      responseBody: { data: { id: 'case_1' } },
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    const conflict = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'create-1')
      .send({ client_id: 'client_2' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('idempotency_conflict');
  });

  it('retries a serializable transaction conflict once', async () => {
    (prisma.$transaction as any)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: any) => callback(txMock));

    const response = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'retry-serialization')
      .send({ client_id: 'client_1' });

    expect(response.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('replays the winner when concurrent requests race on the unique key', async () => {
    (prisma.$transaction as any).mockRejectedValueOnce({ code: 'P2002' });
    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValueOnce({
      requestHash: mortgageRequestHash({ client_id: 'client_1' }),
      responseStatus: 201,
      responseBody: { data: { id: 'case_1' } },
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const response = await request(app())
      .post('/api/v2/cases')
      .set('Idempotency-Key', 'create-race')
      .send({ client_id: 'client_1' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('case_1');
  });

  it('rejects adding a party without active purpose-specific consent', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue(createdCase);
    txMock.consentRevision.findUnique.mockResolvedValue({
      id: 'consent_1',
      status: 'EXPIRED',
      purposeCode: 'mortgage_prescore',
      allowedOperations: ['collect_and_process_questionnaire_data'],
      grantedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      revokedAt: null,
      consent: { clientId: 'client_2' },
    });

    const response = await request(app())
      .post('/api/v2/cases/case_1/parties')
      .send({
        client_id: 'client_2',
        role: 'CO_BORROWER',
        consent_revision_id: 'consent_1',
        expected_version: 1,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONSENT_REQUIRED');
    expect(txMock.mortgageCaseParty.create).not.toHaveBeenCalled();
  });

  it('atomically adds a consented party and advances the case version', async () => {
    txMock.mortgageCase.findUnique
      .mockResolvedValueOnce(createdCase)
      .mockResolvedValueOnce({ ...createdCase, version: 2 });
    txMock.consentRevision.findUnique.mockResolvedValue({
      id: 'consent_1',
      status: 'ACTIVE',
      purposeCode: 'mortgage_prescore',
      allowedOperations: ['collect_and_process_questionnaire_data'],
      grantedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      revokedAt: null,
      consent: { clientId: 'client_2' },
    });
    txMock.mortgageCase.updateMany.mockResolvedValue({ count: 1 });
    txMock.mortgageCaseParty.create.mockResolvedValue({
      id: 'party_2',
      caseId: 'case_1',
      clientId: 'client_2',
      role: 'CO_BORROWER',
      consentRevisionId: 'consent_1',
    });

    const response = await request(app())
      .post('/api/v2/cases/case_1/parties')
      .send({
        client_id: 'client_2',
        role: 'CO_BORROWER',
        consent_revision_id: 'consent_1',
        expected_version: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.party.clientId).toBe('client_2');
    expect(txMock.mortgageCase.updateMany).toHaveBeenCalledWith({
      where: { id: 'case_1', version: 1 },
      data: { version: { increment: 1 } },
    });
  });

  it('hides a foreign case, while owner and ADMIN can read it', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue({ ...createdCase, ownerId: 'broker_2' });
    const foreign = await request(app()).get('/api/v2/cases/case_1');
    expect(foreign.status).toBe(404);

    txMock.mortgageCase.findUnique.mockResolvedValue(createdCase);
    const owner = await request(app()).get('/api/v2/cases/case_1');
    expect(owner.status).toBe(200);

    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    txMock.mortgageCase.findUnique.mockResolvedValue({ ...createdCase, ownerId: 'broker_2' });
    const admin = await request(app()).get('/api/v2/cases/case_1');
    expect(admin.status).toBe(200);
  });

  it('uses expected_version for an atomic status transition', async () => {
    txMock.mortgageCase.findUnique
      .mockResolvedValueOnce(createdCase)
      .mockResolvedValueOnce({ ...createdCase, status: 'CONSENT_PENDING', version: 2 });
    txMock.mortgageCase.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app())
      .patch('/api/v2/cases/case_1')
      .send({ expected_version: 1, status: 'CONSENT_PENDING' });

    expect(response.status).toBe(200);
    expect(txMock.mortgageCase.updateMany).toHaveBeenCalledWith({
      where: { id: 'case_1', version: 1 },
      data: { status: 'CONSENT_PENDING', version: { increment: 1 } },
    });
  });

  it('blocks sensitive status transitions until every party has active consent', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue({
      ...createdCase,
      status: 'CONSENT_PENDING',
      parties: [{ consentRevision: null }],
    });

    const response = await request(app())
      .patch('/api/v2/cases/case_1')
      .send({ expected_version: 1, status: 'DOCUMENTS_PENDING' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONSENT_REQUIRED');
    expect(txMock.mortgageCase.updateMany).not.toHaveBeenCalled();
  });

  it('returns version_conflict before evaluating a transition from newer state', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue({
      ...createdCase,
      status: 'ACTIVE',
      version: 2,
      parties: [],
    });

    const response = await request(app())
      .patch('/api/v2/cases/case_1')
      .send({ expected_version: 1, status: 'CONSENT_PENDING' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('version_conflict');
  });

  it('returns version_conflict without silently overwriting state', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue(createdCase);
    txMock.mortgageCase.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app())
      .patch('/api/v2/cases/case_1')
      .send({ expected_version: 1, status: 'CONSENT_PENDING' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('version_conflict');
  });
});