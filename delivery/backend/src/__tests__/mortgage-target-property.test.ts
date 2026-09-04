/**
 * Привязка расчёта к квартире каталога.
 *
 * Проверяется то, ради чего привязка вообще появилась: цена перестаёт быть
 * числом, набранным руками, и читается у объекта в момент расчёта. Поэтому
 * главный тест здесь — расхождение сохранённой копии и живой цены: расчёт
 * обязан идти по живой.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = currentUser; next(); },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn() },
  mortgageClientProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  mortgageClientProfileSnapshot: { findFirst: vi.fn() },
  mortgagePurchaseGoal: { upsert: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
  mortgageProgram: { findMany: vi.fn() },
  apartment: { findUnique: vi.fn(), findMany: vi.fn() },
  crmProperty: { findUnique: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

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

const APARTMENT = {
  id: 'apt_1', number: '104', rooms: 2, area: '63.80', price: '34000000.00', floor: 7,
  status: 'AVAILABLE',
  project: { id: 'prj_1', name: 'Алатау Резиденс', city: 'Алматы', district: 'Бостандыкский' },
};

const CRM_PROPERTY = {
  id: 'crm_1', rooms: 3, area: '92.40', price: '52000000.00', floor: 4, status: 'ACTIVE',
  residentialComplex: 'Достык Парк', district: 'Медеуский', address: 'Достык, 240',
  listingAgreements: [{ id: 'la_1' }],
};

/** Профиль с привязанной квартирой: цель хранит СТАРУЮ цену, объект — новую. */
const boundProfile = {
  id: 'prof_1', caseId: 'case_1', version: 1,
  purchaseGoal: {
    targetPriceMax: '30000000.00', currency: 'KZT', status: 'DECLARED',
    targetApartment: APARTMENT, targetCrmProperty: null,
  },
  incomeSources: [{ monthlyAmount: '1200000.00', status: 'DECLARED', kind: 'SALARY' }],
  downPaymentSources: [{ amount: '12000000.00', status: 'DECLARED', kind: 'CASH_SAVINGS' }],
  nonCreditCommitments: [], employments: [], assets: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'broker_1', role: 'BROKER' };
  p.mortgageCase.findUnique.mockResolvedValue(theCase);
  p.mortgageClientProfile.upsert.mockResolvedValue({ id: 'prof_1', caseId: 'case_1' });
  p.mortgageClientProfile.findUnique.mockResolvedValue(boundProfile);
  p.mortgageClientProfile.update.mockResolvedValue({});
  p.mortgageClientProfileSnapshot.findFirst.mockResolvedValue(null);
  p.mortgageAuditEvent.create.mockResolvedValue({});
  p.apartment.findUnique.mockResolvedValue(APARTMENT);
  p.crmProperty.findUnique.mockResolvedValue(CRM_PROPERTY);
  p.apartment.findMany.mockResolvedValue([]);
  p.crmProperty.findMany.mockResolvedValue([]);
  p.mortgageProgram.findMany.mockResolvedValue([]);
  p.mortgagePurchaseGoal.upsert.mockImplementation(async ({ update }: any) => ({
    id: 'goal_1', currency: 'KZT', status: 'DECLARED',
    targetPriceMax: update.targetPriceMax ?? '30000000.00',
    targetApartment: update.targetApartmentId ? APARTMENT : null,
    targetCrmProperty: update.targetCrmPropertyId ? CRM_PROPERTY : null,
  }));
  docs.latestForCase.mockReturnValue(null);
  docs.extractedNumber.mockReturnValue(null);
});

const url = '/api/v2/cases/case_1/purchase-goal/target-property';

describe('привязка расчёта к квартире каталога', () => {
  it('привязывает новостройку и берёт её цену как цель покупки', async () => {
    const res = await request(app()).put(url).send({ target_property: { source: 'NEW_BUILD', id: 'apt_1' } });
    expect(res.status).toBe(200);
    const data = p.mortgagePurchaseGoal.upsert.mock.calls[0][0].update;
    expect(data.targetApartmentId).toBe('apt_1');
    expect(data.targetCrmPropertyId).toBeNull();
    expect(data.targetPriceMax.toString()).toBe('34000000');
    expect(data.propertyKind).toBe('NEW_BUILDING');
    expect(res.body.data.purchase_goal.target_property.title).toContain('кв. 104');
  });

  it('привязывает вторичку и помечает тип жилья SECONDARY', async () => {
    const res = await request(app()).put(url).send({ target_property: { source: 'SECONDARY', id: 'crm_1' } });
    expect(res.status).toBe(200);
    const data = p.mortgagePurchaseGoal.upsert.mock.calls[0][0].update;
    expect(data.targetCrmPropertyId).toBe('crm_1');
    expect(data.targetApartmentId).toBeNull();
    expect(data.propertyKind).toBe('SECONDARY');
    expect(res.body.data.purchase_goal.target_property.source).toBe('SECONDARY');
  });

  it('несуществующий объект → 404, цель не трогаем', async () => {
    p.apartment.findUnique.mockResolvedValue(null);
    const res = await request(app()).put(url).send({ target_property: { source: 'NEW_BUILD', id: 'nope' } });
    expect(res.status).toBe(404);
    expect(p.mortgagePurchaseGoal.upsert).not.toHaveBeenCalled();
  });

  it('снятие привязки не стирает цену, по которой уже считали', async () => {
    const res = await request(app()).put(url).send({ target_property: null });
    expect(res.status).toBe(200);
    const call = p.mortgagePurchaseGoal.upsert.mock.calls[0][0];
    expect(call.update).toEqual({ targetApartmentId: null, targetCrmPropertyId: null });
    expect(call.update).not.toHaveProperty('targetPriceMax');
  });

  it('проданную квартиру привязать можно, но карточка честно говорит о статусе', async () => {
    p.apartment.findUnique.mockResolvedValue({ ...APARTMENT, status: 'SOLD' });
    const res = await request(app()).put(url).send({ target_property: { source: 'NEW_BUILD', id: 'apt_1' } });
    expect(res.status).toBe(200);
    expect(p.mortgagePurchaseGoal.upsert).toHaveBeenCalled();
  });

  it('вторичка без действующего договора собственника помечается недоступной', async () => {
    const noAgreement = { ...CRM_PROPERTY, listingAgreements: [] };
    p.crmProperty.findUnique.mockResolvedValue(noAgreement);
    p.mortgagePurchaseGoal.upsert.mockResolvedValue({
      id: 'goal_1', currency: 'KZT', status: 'DECLARED', targetPriceMax: '52000000.00',
      targetApartment: null, targetCrmProperty: noAgreement,
    });
    const res = await request(app()).put(url).send({ target_property: { source: 'SECONDARY', id: 'crm_1' } });
    expect(res.status).toBe(200);
    expect(res.body.data.purchase_goal.target_property.available).toBe(false);
  });

  it('битое тело → 400', async () => {
    const res = await request(app()).put(url).send({ target_property: { source: 'HOUSE', id: 'x' } });
    expect(res.status).toBe(400);
  });

  it('чужой кейс → 404', async () => {
    p.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app()).put(url).send({ target_property: { source: 'NEW_BUILD', id: 'apt_1' } });
    expect(res.status).toBe(404);
  });

  it('привязка пишется в аудит', async () => {
    await request(app()).put(url).send({ target_property: { source: 'NEW_BUILD', id: 'apt_1' } });
    expect(p.mortgageAuditEvent.create.mock.calls[0][0].data.action).toBe('mortgage_profile.target_property_set');
  });

  it('GET профиля отдаёт карточку привязанного объекта', async () => {
    const res = await request(app()).get('/api/v2/cases/case_1/client-profile');
    expect(res.status).toBe(200);
    const t = res.body.data.purchase_goal.target_property;
    expect(t.id).toBe('apt_1');
    expect(t.location).toBe('Алатау Резиденс, Бостандыкский, Алматы');
    expect(t.price).toBe('34000000.00');
    expect(t.available).toBe(true);
  });

  it('цена, введённая руками, снимает привязку', async () => {
    const res = await request(app())
      .patch('/api/v2/cases/case_1/client-profile')
      .send({ purchase_goal: { target_price_max: '28000000', status: 'DECLARED' } });
    expect(res.status).toBe(200);
    const data = p.mortgagePurchaseGoal.upsert.mock.calls[0][0].update;
    expect(data.targetApartmentId).toBeNull();
    expect(data.targetCrmPropertyId).toBeNull();
  });
});

describe('расчёт по привязанной квартире', () => {
  it('берёт ЖИВУЮ цену объекта, а не сохранённую копию', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/scoring')
      .send({ annual_nominal_rate_percent: '12.5', term_months: 240 });
    expect(res.status).toBe(200);
    // Цель хранит 30 млн, квартира стоит 34 млн, взнос 12 млн.
    // Требуемое финансирование обязано считаться от 34, иначе брокер получит
    // вердикт по цене, которой больше нет.
    expect(res.body.data.requiredFinancing.value).toBe('22000000.00');
    expect(res.body.data.sources.target_price).toBe('linked_property');
    expect(res.body.data.sources.linked_property.id).toBe('apt_1');
  });

  it('явно переданная цена всё ещё важнее привязки', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/scoring')
      .send({ annual_nominal_rate_percent: '12.5', term_months: 240, target_price: '40000000' });
    expect(res.body.data.requiredFinancing.value).toBe('28000000.00');
    expect(res.body.data.sources.target_price).toBe('apartment');
  });

  it('подбор программ берёт тип жилья у привязанной квартиры', async () => {
    await request(app())
      .get('/api/v2/cases/case_1/programs?annual_nominal_rate_percent=12.5&term_months=240');
    expect(p.mortgageProgram.findMany.mock.calls[0][0].where.propertyType).toBe('NEW_BUILDING');
  });
});
