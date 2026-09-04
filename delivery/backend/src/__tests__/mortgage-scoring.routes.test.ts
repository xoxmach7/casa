/**
 * Маршруты скоринга и подбора квартир.
 *
 * Этот файл существует из-за реальной регрессии: при рефакторинге маршрут
 * POST /:caseId/scoring перестал регистрироваться, юнит-тесты самого скоринга
 * остались зелёными, CI пропустил, и экран получил 404 «Ошибка сервера».
 * Логика без маршрута недостижима — значит маршрут обязан быть под тестом.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } | null = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!currentUser) { res.status(401).json({ error: 'unauthorized' }); return; }
    req.user = currentUser;
    next();
  },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn() },
  mortgageClientProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  mortgageClientProfileSnapshot: { findFirst: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
  apartment: { findMany: vi.fn() },
  crmProperty: { findMany: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

// Документы лежат в файловом хранилище; для маршрута важен только факт, что
// платежи по кредитам пришли из отчёта ПКБ, а не были введены руками.
const docs = vi.hoisted(() => ({ latestForCase: vi.fn(), extractedNumber: vi.fn() }));
vi.mock('../lib/mortgage-workspace/document-store', async () => {
  const actual = await vi.importActual<typeof import('../lib/mortgage-workspace/document-store')>(
    '../lib/mortgage-workspace/document-store',
  );
  return { ...actual, ...docs };
});

import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/cases', mortgageCasesRouter);
  return i;
}

const theCase = { id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 1 };

const fullProfile = {
  id: 'prof_1', caseId: 'case_1', version: 1,
  purchaseGoal: { targetPriceMax: '30000000.00', status: 'DECLARED' },
  incomeSources: [{ monthlyAmount: '1200000.00', status: 'DECLARED', kind: 'SALARY' }],
  downPaymentSources: [{ amount: '9000000.00', status: 'DECLARED', kind: 'CASH_SAVINGS' }],
  nonCreditCommitments: [],
};

const RUN = { annual_nominal_rate_percent: '12.5', term_months: 240 };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'broker_1', role: 'BROKER' };
  p.mortgageCase.findUnique.mockResolvedValue(theCase);
  p.mortgageClientProfile.upsert.mockResolvedValue({ id: 'prof_1', caseId: 'case_1' });
  p.mortgageClientProfile.findUnique.mockResolvedValue(fullProfile);
  p.mortgageAuditEvent.create.mockResolvedValue({});
  p.apartment.findMany.mockResolvedValue([]);
  p.crmProperty.findMany.mockResolvedValue([]);
  docs.latestForCase.mockReturnValue({ id: 'doc_1', type: 'credit_history' });
  docs.extractedNumber.mockReturnValue('211711.02');
});

describe('POST /:caseId/scoring', () => {
  it('маршрут существует и отдаёт вердикт (а не 404)', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/scoring').send(RUN);
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toBe('FITS');
    expect(res.body.data.requiredFinancing.value).toBe('21000000.00');
    expect(res.body.data.paymentCapacity.value).toBe('388288.98');
  });

  it('платежи по кредитам берутся из отчёта ПКБ, а не у брокера', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/scoring').send(RUN);
    expect(res.body.data.sources.monthly_credit_payments).toBe('credit_report');
    expect(res.body.data.sources.credit_report_id).toBe('doc_1');
  });

  it('нет отчёта ПКБ → NEEDS_DATA с просьбой загрузить его', async () => {
    docs.latestForCase.mockReturnValue(null);
    docs.extractedNumber.mockReturnValue(null);
    const res = await request(app()).post('/api/v2/cases/case_1/scoring').send(RUN);
    expect(res.body.data.verdict).toBe('NEEDS_DATA');
    expect(res.body.data.missing.map((m: any) => m.field)).toContain('monthly_credit_payments');
  });

  it('цена конкретной квартиры переопределяет цель покупки', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/scoring')
      .send({ ...RUN, target_price: '11000000' });
    expect(res.body.data.requiredFinancing.value).toBe('2000000.00');
    expect(res.body.data.sources.target_price).toBe('apartment');
  });

  it('чужой кейс не считается', async () => {
    currentUser = { userId: 'other_broker', role: 'BROKER' };
    const res = await request(app()).post('/api/v2/cases/case_1/scoring').send(RUN);
    expect(res.status).toBe(404);
  });

  it('без авторизации — 401', async () => {
    currentUser = null;
    const res = await request(app()).post('/api/v2/cases/case_1/scoring').send(RUN);
    expect(res.status).toBe(401);
  });
});

describe('GET /:caseId/matching-properties', () => {
  it('маршрут существует и отдаёт бюджет (а не 404)', async () => {
    const res = await request(app())
      .get('/api/v2/cases/case_1/matching-properties')
      .query(RUN);
    expect(res.status).toBe(200);
    // Бюджет = максимальный кредит + взнос, обе части из того же скоринга.
    expect(res.body.data.down_payment).toBe('9000000.00');
    expect(Number(res.body.data.budget)).toBeGreaterThan(Number(res.body.data.max_loan));
    expect(res.body.data.items).toEqual([]);
  });

  it('бюджет не посчитан → пустой список с причиной, а не «все квартиры»', async () => {
    docs.latestForCase.mockReturnValue(null);
    docs.extractedNumber.mockReturnValue(null);
    const res = await request(app())
      .get('/api/v2/cases/case_1/matching-properties')
      .query(RUN);
    expect(res.status).toBe(200);
    expect(res.body.data.budget).toBeNull();
    expect(res.body.data.items).toEqual([]);
    expect(p.apartment.findMany).not.toHaveBeenCalled();
  });

  it('ищет в обоих каталогах в пределах бюджета', async () => {
    await request(app()).get('/api/v2/cases/case_1/matching-properties').query(RUN);
    expect(p.apartment.findMany).toHaveBeenCalledTimes(1);
    expect(p.crmProperty.findMany).toHaveBeenCalledTimes(1);
  });
});
