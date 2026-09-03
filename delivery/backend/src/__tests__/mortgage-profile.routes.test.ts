import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = currentUser; next(); },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn() },
  mortgageClientProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  mortgageDownPaymentSource: { create: vi.fn() },
  mortgageIncomeSource: { create: vi.fn() },
  mortgageAsset: { create: vi.fn() },
  mortgageNonCreditCommitment: { create: vi.fn() },
  mortgageEmployment: { create: vi.fn() },
  mortgageClientProfileSnapshot: { create: vi.fn(), findFirst: vi.fn() },
  mortgagePurchaseGoal: { upsert: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({ prisma: p }));

import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/cases', mortgageCasesRouter);
  return i;
}

const theCase = { id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 1 };
const emptyProfile = {
  id: 'prof_1', caseId: 'case_1', version: 1, purchaseGoal: null,
  employments: [], incomeSources: [], assets: [], downPaymentSources: [], nonCreditCommitments: [],
};

describe('M05 client-profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    p.mortgageCase.findUnique.mockResolvedValue(theCase);
    p.mortgageClientProfile.upsert.mockResolvedValue({ id: 'prof_1', caseId: 'case_1' });
    p.mortgageClientProfile.findUnique.mockResolvedValue(emptyProfile);
    p.mortgageAuditEvent.create.mockResolvedValue({});
    // Экран показывает ссылку на последний снапшот профиля; его может не быть.
    p.mortgageClientProfileSnapshot.findFirst.mockResolvedValue(null);
  });

  it('GET client-profile → 200, авто-создание, агрегат available_now_total', async () => {
    p.mortgageClientProfile.findUnique
      .mockResolvedValueOnce(null) // ensureProfileId: не найден
      .mockResolvedValueOnce({ ...emptyProfile, downPaymentSources: [
        { amount: '3000000.00', status: 'VERIFIED', kind: 'CASH_SAVINGS' },
        { amount: '2000000.00', status: 'DECLARED', kind: 'GIFT' },
      ] });
    const res = await request(app()).get('/api/v2/cases/case_1/client-profile');
    expect(res.status).toBe(200);
    expect(res.body.data.aggregates.available_now_total.value).toBe('5000000.00');
    expect(res.body.data.aggregates.available_now_total.status).toBe('DECLARED');
  });

  it('GET по недоступному кейсу → 404', async () => {
    p.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app()).get('/api/v2/cases/case_x/client-profile');
    expect(res.status).toBe(404);
  });

  it('POST down-payment-sources → 201, создаёт запись + аудит', async () => {
    p.mortgageClientProfile.findUnique.mockResolvedValue({ id: 'prof_1' });
    p.mortgageDownPaymentSource.create.mockResolvedValue({ id: 'dp_1', amount: '3000000.00', status: 'DECLARED' });
    const res = await request(app())
      .post('/api/v2/cases/case_1/down-payment-sources')
      .send({ kind: 'CASH_SAVINGS', amount: 3000000, status: 'DECLARED' });
    expect(res.status).toBe(201);
    expect(p.mortgageDownPaymentSource.create).toHaveBeenCalled();
    expect(p.mortgageAuditEvent.create).toHaveBeenCalled();
  });

  it('ЗАЛОГ не считается деньгами: ADDITIONAL_COLLATERAL исключён из взноса (§13)', async () => {
    p.mortgageClientProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...emptyProfile, downPaymentSources: [
        { amount: '5000000.00', status: 'VERIFIED', kind: 'CASH_SAVINGS' },
        { amount: '9000000.00', status: 'VERIFIED', kind: 'ADDITIONAL_COLLATERAL' },
      ] });
    const res = await request(app()).get('/api/v2/cases/case_1/client-profile');
    expect(res.status).toBe(200);
    // 9 млн залога НЕ прибавились — иначе занизили бы требуемое финансирование.
    expect(res.body.data.aggregates.available_now_total.value).toBe('5000000.00');
    expect(res.body.data.aggregates.available_now_total.excludedNonMonetary).toBe(1);
  });

  it('источник с неопределённой допустимостью (OTHER) делает агрегат неполным, а не нулём', async () => {
    p.mortgageClientProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...emptyProfile, downPaymentSources: [
        { amount: '5000000.00', status: 'VERIFIED', kind: 'CASH_SAVINGS' },
        { amount: '1000000.00', status: 'DECLARED', kind: 'OTHER' },
      ] });
    const res = await request(app()).get('/api/v2/cases/case_1/client-profile');
    expect(res.body.data.aggregates.available_now_total.value).toBeNull();
    expect(res.body.data.aggregates.available_now_total.status).toBe('UNKNOWN');
  });

  it('VERIFIED нельзя выставить из тела запроса (RG-CP-03)', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/down-payment-sources')
      .send({ kind: 'CASH_SAVINGS', amount: 3000000, status: 'VERIFIED' });
    expect(res.status).toBe(400);
    expect(p.mortgageDownPaymentSource.create).not.toHaveBeenCalled();
  });

  it('POST down-payment-sources с плохим body → 400', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/down-payment-sources')
      .send({ status: 'BAD' });
    expect(res.status).toBe(400);
  });

  it('POST client-profile/publish-snapshot → 201 с content_hash', async () => {
    p.mortgageClientProfile.findUnique.mockResolvedValue({
      ...emptyProfile,
      downPaymentSources: [{ amount: '5000000.00', status: 'VERIFIED', kind: 'CASH_SAVINGS' }],
    });
    p.mortgageClientProfileSnapshot.create.mockImplementation(async ({ data }: any) => ({ id: 'snap_1', ...data, createdAt: new Date() }));
    p.mortgageClientProfile.update.mockResolvedValue({});
    const res = await request(app()).post('/api/v2/cases/case_1/client-profile/publish-snapshot');
    expect(res.status).toBe(201);
    expect(res.body.data.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.payload.available_now_total.value).toBe('5000000.00');
  });

  it('PATCH client-profile задаёт purchase_goal (API-M05-002)', async () => {
    p.mortgageClientProfile.findUnique.mockResolvedValue({ id: 'prof_1' });
    p.mortgageClientProfile.update.mockResolvedValue({});
    p.mortgagePurchaseGoal.upsert.mockImplementation(async ({ create, update }: any) => ({
      id: 'goal_1', ...create, ...update,
    }));
    const res = await request(app())
      .patch('/api/v2/cases/case_1/client-profile')
      .send({ purchase_goal: { target_price_max: '30000000', status: 'DECLARED' } });
    expect(res.status).toBe(200);
    expect(res.body.data.purchase_goal.target_price_max).toBe('30000000.00');
    expect(res.body.data.purchase_goal.status).toBe('DECLARED');
  });

  it('PATCH с пустой целью → статус UNKNOWN, а не «заявлено без цифры»', async () => {
    p.mortgageClientProfile.findUnique.mockResolvedValue({ id: 'prof_1' });
    p.mortgageClientProfile.update.mockResolvedValue({});
    p.mortgagePurchaseGoal.upsert.mockImplementation(async ({ create }: any) => ({ id: 'goal_1', ...create }));
    const res = await request(app())
      .patch('/api/v2/cases/case_1/client-profile')
      .send({ purchase_goal: { target_price_max: null, status: 'DECLARED' } });
    expect(res.status).toBe(200);
    expect(res.body.data.purchase_goal.target_price_max).toBeNull();
    expect(res.body.data.purchase_goal.status).toBe('UNKNOWN');
  });

  it('снапшот профиля несёт purchase_goal и selected_upstream_refs', async () => {
    p.mortgageClientProfile.findUnique.mockResolvedValue({
      ...emptyProfile,
      purchaseGoal: { targetPriceMax: '30000000.00', currency: 'KZT', status: 'DECLARED' },
      downPaymentSources: [{ amount: '5000000.00', status: 'VERIFIED', kind: 'CASH_SAVINGS' }],
    });
    p.mortgageClientProfileSnapshot.create.mockImplementation(async ({ data }: any) => ({ id: 'snap_2', ...data, createdAt: new Date() }));
    p.mortgageClientProfile.update.mockResolvedValue({});
    const res = await request(app()).post('/api/v2/cases/case_1/client-profile/publish-snapshot');
    expect(res.status).toBe(201);
    expect(res.body.data.payload.purchase_goal.target_price_max).toBe('30000000.00');
    // Каноничные M02/M03/M04 ещё не реализованы — честный null, не выдуманный id.
    expect(res.body.data.payload.selected_upstream_refs).toEqual({
      iin_check_batch_id: null, credit_history_snapshot_id: null, pension_snapshot_id: null,
    });
  });
});
