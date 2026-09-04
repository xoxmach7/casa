/**
 * Фиксация покупателя — гейты, на которых держится комиссия.
 *
 * Проверяется не «создаётся ли запись», а то, что её НЕЛЬЗЯ создать в обход:
 * без договора с собственником, без подписки, сверх лимита тарифа, на чужого
 * покупателя и вторым агентом на того же человека.
 *
 * Отдельно — защитный период: именно он превращает «продали мимо нас через
 * месяц после истечения фиксации» из потери в основание для комиссии.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.MARKETPLACE_IDENTITY_HMAC_KEY = 'k'.repeat(40);

const p = vi.hoisted(() => ({
  crmProperty: { findUnique: vi.fn() },
  listingAgreement: { findFirst: vi.fn() },
  buyer: { findUnique: vi.fn() },
  agencySubscription: { findFirst: vi.fn() },
  secondaryFixation: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  secondaryFixationStatusLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { createFixation, findCoveringFixation, FixationError } from '../lib/marketplace/fixation.service';

const INPUT = {
  propertyId: 'prop_1',
  buyerId: 'buyer_1',
  agentId: 'agent_1',
  agencyId: 'agency_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  p.crmProperty.findUnique.mockResolvedValue({ id: 'prop_1', status: 'ACTIVE', funnelStage: 'LEADS' });
  p.listingAgreement.findFirst.mockResolvedValue({
    id: 'agr_1',
    tier: 'BASIC',
    buyerAgentSharePercent: '50.00',
    protectionPeriodDays: 90,
  });
  p.buyer.findUnique.mockResolvedValue({ id: 'buyer_1', phone: '+77771234567', brokerId: 'agent_1' });
  p.agencySubscription.findFirst.mockResolvedValue({
    id: 'sub_1',
    status: 'ACTIVE',
    expiresAt: null,
    maxActiveFixations: 15,
  });
  p.secondaryFixation.count.mockResolvedValue(0);
  p.secondaryFixation.findFirst.mockResolvedValue(null);
  p.$transaction.mockImplementation(async (fn: any) =>
    fn({
      secondaryFixation: { create: vi.fn().mockResolvedValue({ id: 'fix_1', status: 'CONFIRMED' }) },
      secondaryFixationStatusLog: { create: vi.fn() },
    }),
  );
});

describe('гейты фиксации', () => {
  it('создаётся, когда все условия выполнены', async () => {
    const fixation = await createFixation(INPUT);

    expect(fixation.id).toBe('fix_1');
    expect(fixation.status).toBe('CONFIRMED');
  });

  it('без договора с собственником фиксация невозможна', async () => {
    p.listingAgreement.findFirst.mockResolvedValue(null);

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'LISTING_AGREEMENT_REQUIRED',
      status: 409,
    });
  });

  it('без действующей подписки фиксация невозможна', async () => {
    p.agencySubscription.findFirst.mockResolvedValue(null);

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'MARKETPLACE_SUBSCRIPTION_REQUIRED',
      status: 403,
    });
  });

  it('лимит тарифа останавливает на границе, а не после неё', async () => {
    p.secondaryFixation.count.mockResolvedValue(15);

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'FIXATION_LIMIT_REACHED',
    });
  });

  it('чужого покупателя фиксировать нельзя — иначе фиксация не доказывает, кто привёл', async () => {
    p.buyer.findUnique.mockResolvedValue({
      id: 'buyer_1',
      phone: '+77771234567',
      brokerId: 'agent_2',
    });

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'BUYER_NOT_OWNED',
      status: 403,
    });
  });

  it('второй агент на того же покупателя получает отказ по дублю', async () => {
    p.secondaryFixation.findFirst.mockResolvedValue({
      id: 'fix_existing',
      agentId: 'agent_2',
    });

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'REJECTED_DUPLICATE',
      status: 409,
    });
  });

  it('свой же повторный запрос отличается от чужого дубля', async () => {
    p.secondaryFixation.findFirst.mockResolvedValue({
      id: 'fix_existing',
      agentId: 'agent_1',
    });

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'ALREADY_FIXED_BY_YOU',
    });
  });

  it('без ключа отпечатков отвечает «не настроено», а не падает на 500', async () => {
    const saved = process.env.MARKETPLACE_IDENTITY_HMAC_KEY;
    const savedIin = process.env.IIN_LOOKUP_HMAC_KEY;
    delete process.env.MARKETPLACE_IDENTITY_HMAC_KEY;
    delete process.env.IIN_LOOKUP_HMAC_KEY;
    try {
      await expect(createFixation(INPUT)).rejects.toMatchObject({
        code: 'MARKETPLACE_NOT_CONFIGURED',
        status: 503,
      });
      // И ни одного обращения к базе: смысла нет, сравнивать всё равно нечем.
      expect(p.crmProperty.findUnique).not.toHaveBeenCalled();
    } finally {
      if (saved) process.env.MARKETPLACE_IDENTITY_HMAC_KEY = saved;
      if (savedIin) process.env.IIN_LOOKUP_HMAC_KEY = savedIin;
    }
  });

  it('несуществующий объект не создаёт фиксацию', async () => {
    p.crmProperty.findUnique.mockResolvedValue(null);

    await expect(createFixation(INPUT)).rejects.toMatchObject({
      code: 'PROPERTY_NOT_FOUND',
      status: 404,
    });
  });

  it('дубль-чек идёт по отпечатку, а не по id покупателя', async () => {
    // Тот же человек, заведённый в CRM второй раз с другим id, должен
    // отлавливаться: сравнение по buyerIdentityHash, а не по buyerId.
    await createFixation(INPUT);

    const dupCheckCall = p.secondaryFixation.findFirst.mock.calls.find(
      (call: any) => call[0]?.where?.buyerIdentityHash,
    );
    expect(dupCheckCall).toBeDefined();
    expect(dupCheckCall![0].where.buyerIdentityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(dupCheckCall![0].where.propertyId).toBe('prop_1');
  });
});

describe('защитный период', () => {
  it('ищет покрывающую фиксацию по protectionUntil, а не по сроку самой фиксации', async () => {
    p.secondaryFixation.findFirst.mockResolvedValue({ id: 'fix_1' });

    await findCoveringFixation('prop_1', 'a'.repeat(64));

    const where = p.secondaryFixation.findFirst.mock.calls[0][0].where;
    expect(where.protectionUntil).toBeDefined();
    expect(where.expiresAt).toBeUndefined();
  });

  it('отклонённые и отменённые фиксации ничего не покрывают', async () => {
    await findCoveringFixation('prop_1', 'a'.repeat(64));

    const where = p.secondaryFixation.findFirst.mock.calls[0][0].where;
    expect(where.status.notIn).toEqual(
      expect.arrayContaining(['REJECTED_DUPLICATE', 'REJECTED_OTHER', 'CANCELLED']),
    );
  });
});

describe('ошибки фиксации', () => {
  it('несут машинный код, а не только текст', async () => {
    p.listingAgreement.findFirst.mockResolvedValue(null);

    const error = await createFixation(INPUT).catch((e) => e);
    expect(error).toBeInstanceOf(FixationError);
    expect(error.code).toBeTruthy();
    expect(error.status).toBeGreaterThanOrEqual(400);
  });
});
