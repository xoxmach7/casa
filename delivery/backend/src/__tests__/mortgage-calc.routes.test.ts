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
  mortgageClientProfileSnapshot: { findUnique: vi.fn(), findFirst: vi.fn() },
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

const theCase = {
  id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 1,
  parties: [
    { id: 'party_1', clientId: 'client_1', role: 'PRIMARY', includedInAnalysis: true },
    // Супруг добавлен, но НЕ включён в анализ (M01: связь ≠ созаёмщик).
    { id: 'party_2', clientId: 'client_2', role: 'CO_BORROWER', includedInAnalysis: false },
  ],
};

/** Снапшот профиля M05 — единственный источник денег для прогона (§21). */
const profileSnapshot = {
  id: 'cps_1',
  caseId: 'case_1',
  contentHash: 'f'.repeat(64),
  payloadJson: {
    case_id: 'case_1',
    version: 1,
    purchase_goal: { target_price_max: '30000000.00', currency: 'KZT', status: 'VERIFIED' },
    available_now_total: { value: '5000000.00', status: 'CONFIRMED', complete: true, currency: 'KZT' },
    selected_upstream_refs: {
      iin_check_batch_id: null, credit_history_snapshot_id: null, pension_snapshot_id: null,
    },
  },
};

/** Тело прогона: ссылка на снапшот + явные параметры. Денег в теле НЕТ. */
const runBody = {
  client_profile_snapshot_id: 'cps_1',
  parameters: { annual_nominal_rate_percent: '12.5', term_months: 240, payment_frequency: 'MONTHLY' },
};

describe('M06 calculation-runs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    txMock.mortgageIdempotencyRecord.findUnique.mockResolvedValue(null);
    txMock.mortgageCase.findUnique.mockResolvedValue(theCase);
    txMock.mortgageClientProfileSnapshot.findUnique.mockResolvedValue(profileSnapshot);
    txMock.mortgageCalculationRun.create.mockResolvedValue({ id: 'run_1', caseId: 'case_1', status: 'COMPLETED', createdAt: new Date('2026-08-25T00:00:00Z') });
    txMock.mortgageCalculationSnapshot.create.mockImplementation(async ({ data }: any) => ({ id: 'snap_1', ...data, createdAt: new Date('2026-08-25T00:00:00Z') }));
    txMock.mortgageAuditEvent.create.mockResolvedValue({});
    txMock.mortgageIdempotencyRecord.create.mockResolvedValue({});
  });

  it('POST без Idempotency-Key → 400', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/calculation-runs').send(runBody);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('idempotency_key_required');
  });

  it('POST → 201, расчёт (25M / 284035.14) и три хэша §29 в снапшоте', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-golden-1')
      .send(runBody);
    expect(res.status).toBe(201);
    const snapArg = txMock.mortgageCalculationSnapshot.create.mock.calls[0][0].data;
    expect(snapArg.resultsJson.requiredFinancing.value).toBe('25000000.00');
    expect(snapArg.resultsJson.annuity.value).toBe('284035.14');
    expect(snapArg.status).toBe('COMPLETED');
    expect(snapArg.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapArg.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapArg.replayHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapArg.canonicalizationVersion).toBe('CASA-CJ-1');
    // Снапшот профиля связан с прогоном — это условие воспроизводимости.
    expect(snapArg.clientProfileSnapshotId).toBe('cps_1');
    expect(snapArg.clientProfileSnapshotHash).toBe('f'.repeat(64));
    expect(txMock.mortgageAuditEvent.create).toHaveBeenCalled();
    expect(res.body.data.results.annuity.value).toBe('284035.14');
    expect(res.body.data.replay_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('деньги в теле запроса отвергаются: расчёт нельзя подсунуть мимо профиля', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-inject')
      .send({ ...runBody, target_price_max: 999_000_000, available_now_total: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(txMock.mortgageCalculationSnapshot.create).not.toHaveBeenCalled();
  });

  it('без снапшота профиля → 409, снапшот расчёта не создаётся', async () => {
    txMock.mortgageClientProfileSnapshot.findUnique.mockResolvedValue(null);
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-no-profile')
      .send(runBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('client_profile_snapshot_required');
    expect(txMock.mortgageCalculationSnapshot.create).not.toHaveBeenCalled();
  });

  it('снапшот профиля другого кейса → 409 (не источник для этого расчёта)', async () => {
    txMock.mortgageClientProfileSnapshot.findUnique.mockResolvedValue({ ...profileSnapshot, caseId: 'case_other' });
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-cross-case')
      .send(runBody);
    expect(res.status).toBe(409);
    expect(txMock.mortgageCalculationSnapshot.create).not.toHaveBeenCalled();
  });

  it('POST по недоступному кейсу → 404 (object-level authz)', async () => {
    txMock.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app())
      .post('/api/v2/cases/case_x/calculation-runs')
      .set('Idempotency-Key', 'k2').send(runBody);
    expect(res.status).toBe(404);
  });

  it('цель покупки не задана в снапшоте → 201, статус BLOCKED, значения null', async () => {
    txMock.mortgageClientProfileSnapshot.findUnique.mockResolvedValue({
      ...profileSnapshot,
      payloadJson: {
        ...profileSnapshot.payloadJson,
        purchase_goal: { target_price_max: null, currency: 'KZT', status: 'UNKNOWN' },
      },
    });
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-blocked')
      .send(runBody);
    expect(res.status).toBe(201);
    const snapArg = txMock.mortgageCalculationSnapshot.create.mock.calls[0][0].data;
    expect(snapArg.status).toBe('BLOCKED');
    expect(snapArg.resultsJson.requiredFinancing.value).toBeNull();
    expect(snapArg.resultsJson.annuity.value).toBeNull();
  });

  it('неполный агрегат взноса (UNKNOWN) не превращается в ноль', async () => {
    txMock.mortgageClientProfileSnapshot.findUnique.mockResolvedValue({
      ...profileSnapshot,
      payloadJson: {
        ...profileSnapshot.payloadJson,
        available_now_total: { value: null, status: 'UNKNOWN', complete: false, currency: 'KZT' },
      },
    });
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-unknown-dp')
      .send(runBody);
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

  it('GET snapshot своего кейса → 200 и отдаёт три хэша', async () => {
    txMock.mortgageCalculationSnapshot.findUnique.mockResolvedValue({
      id: 'snap_1', caseId: 'case_1', runId: 'run_1',
      schemaVersion: 'casa.calculation_snapshot/1.0.0',
      engineVersion: 'casa-calc-engine/1.0.0', decimalContextVersion: 'x',
      formulaRegistryVersion: 'm06-registry/1.0.0', canonicalizationVersion: 'CASA-CJ-1',
      inputHash: 'a', outputHash: 'b', replayHash: 'c',
      clientProfileSnapshotId: 'cps_1', clientProfileSnapshotHash: 'f'.repeat(64),
      replayPayloadJson: {},
      resultsJson: { status: 'COMPLETED' }, status: 'COMPLETED', createdAt: new Date(),
      mortgageCase: theCase,
    });
    const res = await request(app()).get('/api/v2/cases/case_1/calculation-snapshots/snap_1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('snap_1');
    expect(res.body.data.replay_hash).toBe('c');
    expect(res.body.data.canonicalization_version).toBe('CASA-CJ-1');
  });

  it('§21: прогон сохраняет полный execution context, а не только суммы', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-context')
      .send(runBody);
    expect(res.status).toBe(201);

    const runArg = txMock.mortgageCalculationRun.create.mock.calls[0][0].data;

    // Область доступа и актор
    expect(runArg.tenantId).toBe('broker_1');
    expect(runArg.tenantScopeKind).toBe('CASE_OWNER');
    expect(runArg.actorId).toBe('broker_1');

    // Профиль
    expect(runArg.clientProfileSnapshotId).toBe('cps_1');
    expect(runArg.clientProfileSnapshotHash).toBe('f'.repeat(64));

    // participant_scope: точные id/роли/included_in_analysis, без неявных сумм
    expect(runArg.participantScopeJson).toEqual([
      { participant_id: 'party_1', client_id: 'client_1', role: 'PRIMARY', included_in_analysis: true },
      { participant_id: 'party_2', client_id: 'client_2', role: 'CO_BORROWER', included_in_analysis: false },
    ]);

    // Выбранные формулы с версиями — сохранены явно
    expect(runArg.requestedCalculationsJson).toEqual([
      expect.objectContaining({ formula_id: 'CALC-F-001', formula_version: '1.0.0' }),
      expect.objectContaining({ formula_id: 'CALC-F-002', formula_version: '1.0.0' }),
    ]);
    expect(runArg.formulaRegistryVersion).toBe('m06-registry/1.0.0');

    // Параметры с провенансом
    expect(runArg.parametersJson).toEqual({
      annual_nominal_rate_percent: '12.5',
      term_months: 240,
      payment_frequency: 'MONTHLY',
      source: 'OPERATOR_INPUT',
      channel: 'CASA_PRO_UI',
      actor_id: 'broker_1',
    });

    // Upstream refs, результаты, блокеры, идемпотентность
    expect(runArg.selectedUpstreamRefsJson).toEqual({
      iin_check_batch_id: null, credit_history_snapshot_id: null, pension_snapshot_id: null,
    });
    expect(runArg.resultsJson.annuity.value).toBe('284035.14');
    expect(runArg.blockersJson).toEqual([]);
    expect(runArg.idempotencyKey).toBe('k-context');
    expect(runArg.requestHash).toMatch(/^[0-9a-f]+$/);

    // Снапшот тоже несёт tenant (DC-M06-CAN-0059)
    const snapArg = txMock.mortgageCalculationSnapshot.create.mock.calls[0][0].data;
    expect(snapArg.tenantId).toBe('broker_1');
  });

  it('запрошенные формулы сохраняются в указанном порядке', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-order')
      .send({ ...runBody, requested_calculations: ['CALC-F-002', 'CALC-F-001'] });
    expect(res.status).toBe(201);
    const runArg = txMock.mortgageCalculationRun.create.mock.calls[0][0].data;
    expect(runArg.requestedCalculationsJson.map((f: any) => f.formula_id))
      .toEqual(['CALC-F-002', 'CALC-F-001']);
  });

  it('запрос отключённой REG-F-001 (банковский КДН) → 422, прогон не создаётся', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-kdn')
      .send({ ...runBody, requested_calculations: ['REG-F-001'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('formula_disabled');
    expect(txMock.mortgageCalculationRun.create).not.toHaveBeenCalled();
    expect(txMock.mortgageCalculationSnapshot.create).not.toHaveBeenCalled();
  });

  it('запрос неизвестной формулы → 422, прогон не создаётся', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/calculation-runs')
      .set('Idempotency-Key', 'k-unknown')
      .send({ ...runBody, requested_calculations: ['CALC-F-999'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('unknown_formula');
    expect(txMock.mortgageCalculationRun.create).not.toHaveBeenCalled();
  });
});
