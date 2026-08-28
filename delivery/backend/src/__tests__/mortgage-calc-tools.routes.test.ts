/**
 * Калькулятор брокера на движке M06.
 *
 * Проверяется главное: считает СЕРВЕР утверждёнными формулами, результат
 * совпадает с каноническим прогоном на тех же входах, и при этом прикидка
 * невозможно спутать с артефактом кейса — нет хэшей, нет снапшота, есть явный
 * маркер. И ни при каких условиях нет КДН, вердиктов и вероятности одобрения.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { userId: 'broker_1', role: 'BROKER' }; next(); },
}));

const p = vi.hoisted(() => ({ mortgageProgram: { findMany: vi.fn() } }));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { mortgageCalcToolsRouter } from '../routes/mortgage-calc-tools.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/calculation-tools', mortgageCalcToolsRouter);
  return i;
}

const GOLDEN_BODY = {
  target_price: '30000000.00',
  available_now_down_payment: '5000000.00',
  annual_nominal_rate_percent: '12.5',
  term_months: 240,
};

beforeEach(() => {
  vi.clearAllMocks();
  p.mortgageProgram.findMany.mockResolvedValue([]);
});

describe('POST /calculation-tools/quote', () => {
  it('считает теми же формулами: 25M финансирования и платёж 284035.14', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote').send(GOLDEN_BODY);
    expect(res.status).toBe(200);
    expect(res.body.data.required_financing.value).toBe('25000000.00');
    expect(res.body.data.annuity_payment.value).toBe('284035.14');
    // Тот же decimal-контекст, что и в каноническом прогоне: 50 знаков сырого.
    expect(res.body.data.annuity_payment.raw)
      .toBe('284035.13742859237380498879610315991992807755394768');
    expect(res.body.data.decimal_context_version)
      .toBe('casa.decimal_context/p50-half-even__money-half-up/1.0.0');
  });

  it('помечен как НЕ артефакт кейса и не содержит хэшей', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote').send(GOLDEN_BODY);
    expect(res.body.data.is_case_artifact).toBe(false);
    expect(res.body.data.note).toContain('не заменяет расчёт по ипотечному кейсу');
    const body = JSON.stringify(res.body);
    for (const forbidden of ['input_hash', 'output_hash', 'replay_hash', 'snapshot_id', 'calculation_run']) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('не содержит КДН, вердиктов и вероятности одобрения', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote').send(GOLDEN_BODY);
    const body = JSON.stringify(res.body).toLowerCase();
    for (const forbidden of ['kdn', 'кдн', 'verdict', 'вердикт', 'вероятност', 'score', 'одобрен']) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('без взноса считает от полной цены, а не блокируется', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote').send({
      target_price: '30000000.00', annual_nominal_rate_percent: '12.5', term_months: 240,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.required_financing.value).toBe('30000000.00');
  });

  it('взнос покрывает цену → финансирование 0, платёж 0, код прокинут', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote').send({
      ...GOLDEN_BODY, target_price: '5000000.00', available_now_down_payment: '9000000.00',
    });
    expect(res.body.data.required_financing.value).toBe('0.00');
    expect(res.body.data.annuity_payment.value).toBe('0.00');
    expect(res.body.data.required_financing.codes).toContain('DOWN_PAYMENT_COVERS_TARGET');
  });

  it('некорректный срок отвергается, а не «чинится»', async () => {
    for (const term of [0, -12, 1201]) {
      const res = await request(app()).post('/api/v2/calculation-tools/quote')
        .send({ ...GOLDEN_BODY, term_months: term });
      expect(res.status).toBe(400);
    }
  });

  it('ставка выше 100% → INVALID_INPUT от движка, а не молчаливый расчёт', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/quote')
      .send({ ...GOLDEN_BODY, annual_nominal_rate_percent: '150' });
    expect(res.status).toBe(200);
    expect(res.body.data.annuity_payment.status).toBe('INVALID_INPUT');
    expect(res.body.data.annuity_payment.value).toBeNull();
    expect(res.body.data.annuity_payment.codes).toContain('INVALID_RATE');
  });
});

describe('POST /calculation-tools/program-quotes', () => {
  beforeEach(() => {
    p.mortgageProgram.findMany.mockResolvedValue([
      {
        id: 'p1', bankName: 'Банк А', programName: 'Стандарт',
        interestRate: { toString: () => '12.5' }, minDownPayment: { toString: () => '20' },
        maxTerm: 240, propertyType: 'SECONDARY',
      },
      {
        id: 'p2', bankName: 'Банк Б', programName: 'Короткая',
        interestRate: { toString: () => '18' }, minDownPayment: { toString: () => '30' },
        maxTerm: 120, propertyType: 'SECONDARY',
      },
    ]);
  });

  it('считает платёж по ставке каждой программы', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/program-quotes').send({
      target_price: '30000000.00', available_now_down_payment: '5000000.00', term_months: 240,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.quotes).toHaveLength(2);
    expect(res.body.data.quotes[0].annuity_payment.value).toBe('284035.14');
    expect(res.body.data.quotes[0].program.bank_name).toBe('Банк А');
  });

  it('срок ограничивается предельным сроком программы и это видно', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/program-quotes').send({
      target_price: '30000000.00', available_now_down_payment: '5000000.00', term_months: 240,
    });
    const short = res.body.data.quotes.find((q: any) => q.program.id === 'p2');
    expect(short.term_months_used).toBe(120);
    expect(short.term_capped_by_program).toBe(true);
  });

  it('никаких вердиктов, отбора и вероятности одобрения', async () => {
    const res = await request(app()).post('/api/v2/calculation-tools/program-quotes').send({
      target_price: '30000000.00', term_months: 240,
    });
    expect(res.body.data.disclaimer).toContain('не одобрение');
    const body = JSON.stringify(res.body).toLowerCase();
    for (const forbidden of ['verdict', 'вердикт', 'подходит', 'eligible', 'вероятност', 'kdn', 'кдн']) {
      expect(body).not.toContain(forbidden);
    }
    // Программы не фильтруются по «пригодности» — отдаются все активные.
    expect(res.body.data.quotes).toHaveLength(2);
  });
});
