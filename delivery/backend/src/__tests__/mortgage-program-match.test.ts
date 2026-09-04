/**
 * Подбор ипотечных программ под клиента.
 *
 * Проверяется то, ради чего брокер открывает экран: платёж считается по ставке
 * КАЖДОЙ программы, формальные условия программы реально проверяются, а
 * «подходит» не превращается в обещание одобрения.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const db = vi.hoisted(() => ({ mortgageProgram: { findMany: vi.fn() } }));
vi.mock('../lib/prisma', () => ({ prisma: db }));

import { matchPrograms } from '../lib/mortgage-workspace/program-match.service';

const D = (v: string) => new Prisma.Decimal(v);

const CHEAP = {
  id: 'p_cheap', bankName: 'Отбасы банк', programName: '7-20-25',
  interestRate: D('7'), interestRateTo: D('7'), aprFrom: null,
  minDownPayment: D('20'), maxTerm: 300, maxAmountKzt: D('30000000'),
  propertyType: 'NEW_BUILDING', requirements: 'Только готовое жильё',
  sourceUrl: 'https://example.kz', ratesAsOf: new Date('2026-09-04'), isActive: true,
};

const MARKET = {
  ...CHEAP, id: 'p_market', bankName: 'Halyk Bank', programName: 'Цифровая ипотека',
  interestRate: D('20.5'), interestRateTo: D('24'), aprFrom: D('23'),
  minDownPayment: D('20'), maxTerm: 240, maxAmountKzt: null,
};

const BIG_DOWN = {
  ...CHEAP, id: 'p_big', bankName: 'ForteBank', programName: 'Под заклад',
  interestRate: D('5'), interestRateTo: D('15'), aprFrom: D('5.2'),
  minDownPayment: D('30'), maxTerm: 180, maxAmountKzt: D('100000000'),
};

// Цена 30 млн, взнос 9 млн (30%), свободный платёж 400 тыс.
const INPUT = {
  targetPrice: { value: '30000000', status: 'DECLARED' as const },
  availableNowDownPayment: { value: '9000000', status: 'DECLARED' as const },
  paymentCapacity: '400000.00',
  termMonths: 240,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.mortgageProgram.findMany.mockResolvedValue([CHEAP, MARKET, BIG_DOWN]);
});

describe('подбор ипотечных программ', () => {
  it('берёт только действующие программы', async () => {
    await matchPrograms(INPUT);
    expect(db.mortgageProgram.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });

  it('платёж считается по ставке каждой программы, а не по одной общей', async () => {
    const r = await matchPrograms(INPUT);
    const cheap = r.items.find((i) => i.id === 'p_cheap')!;
    const market = r.items.find((i) => i.id === 'p_market')!;
    // Заём один и тот же (21 млн), ставка разная — платёж обязан отличаться.
    expect(cheap.loanAmount).toBe('21000000.00');
    expect(market.loanAmount).toBe('21000000.00');
    expect(Number(market.monthlyPayment)).toBeGreaterThan(Number(cheap.monthlyPayment));
  });

  it('переплата считается на сервере: платёж × срок − заём', async () => {
    const r = await matchPrograms(INPUT);
    const cheap = r.items.find((i) => i.id === 'p_cheap')!;
    const expected = Number(cheap.monthlyPayment) * cheap.termMonthsUsed - Number(cheap.loanAmount);
    expect(Math.abs(Number(cheap.overpayment) - expected)).toBeLessThan(1);
  });

  it('срок урезается пределом программы и это видно', async () => {
    const r = await matchPrograms({ ...INPUT, termMonths: 300 });
    const market = r.items.find((i) => i.id === 'p_market')!;
    expect(market.termMonthsUsed).toBe(240);
    expect(market.termCappedByProgram).toBe(true);
  });

  it('взнос ниже минимального по программе — не подходит, с причиной', async () => {
    // Взнос 15% при минимальных 20/30%.
    const r = await matchPrograms({ ...INPUT, availableNowDownPayment: { value: '4500000', status: 'DECLARED' } });
    const cheap = r.items.find((i) => i.id === 'p_cheap')!;
    expect(cheap.fits).toBe(false);
    expect(cheap.blockers.join(' ')).toMatch(/нужен взнос от 20%/);
  });

  it('сумма займа выше предела программы — не подходит', async () => {
    // Заём 51 млн при пределе 30 млн у 7-20-25.
    const r = await matchPrograms({
      ...INPUT,
      targetPrice: { value: '60000000', status: 'DECLARED' },
      availableNowDownPayment: { value: '9000000', status: 'DECLARED' },
    });
    const cheap = r.items.find((i) => i.id === 'p_cheap')!;
    expect(cheap.blockers.join(' ')).toMatch(/выше предела программы/);
  });

  it('платёж больше свободного — не подходит', async () => {
    const r = await matchPrograms({ ...INPUT, paymentCapacity: '50000.00' });
    expect(r.items.every((i) => i.fits)).toBe(false);
    expect(r.items.some((i) => i.blockers.includes('платёж больше свободного платежа клиента'))).toBe(true);
  });

  it('подходящие идут первыми, внутри — дешевле платёж выше', async () => {
    const r = await matchPrograms(INPUT);
    const fits = r.items.filter((i) => i.fits);
    expect(fits.length).toBeGreaterThan(0);
    expect(r.items[0].fits).toBe(true);
    for (let i = 1; i < fits.length; i++) {
      expect(Number(fits[i].monthlyPayment)).toBeGreaterThanOrEqual(Number(fits[i - 1].monthlyPayment));
    }
  });

  it('платёж отдаётся диапазоном: по нижней и по верхней границе ставки', async () => {
    // «0,1-18,5%» и «5-15%» отличаются в разы. Показать только нижнюю границу
    // значит назвать клиенту платёж, которого он не увидит.
    const r = await matchPrograms(INPUT);
    const big = r.items.find((i) => i.id === 'p_big')!;
    expect(Number(big.monthlyPaymentMax)).toBeGreaterThan(Number(big.monthlyPayment));
    expect(Number(big.overpaymentMax)).toBeGreaterThan(Number(big.overpayment));
  });

  it('у программы с одной ставкой обе границы совпадают', async () => {
    const r = await matchPrograms(INPUT);
    const cheap = r.items.find((i) => i.id === 'p_cheap')!;
    expect(cheap.monthlyPaymentMax).toBe(cheap.monthlyPayment);
  });

  it('доля взноса считается и отдаётся брокеру', async () => {
    const r = await matchPrograms(INPUT);
    expect(r.downPaymentPercent).toBe('30');
  });

  it('нет цены — нет выдуманных нулей', async () => {
    const r = await matchPrograms({ ...INPUT, targetPrice: { value: null, status: 'MISSING' } });
    expect(r.downPaymentPercent).toBeNull();
    expect(r.items.every((i) => i.monthlyPayment === null)).toBe(true);
    expect(r.items.every((i) => !i.fits)).toBe(true);
  });

  it('ответ не обещает одобрения банка', async () => {
    const r = await matchPrograms(INPUT);
    expect(r.disclaimer).toMatch(/решение по заявке принимает банк/i);
    // Оговорка про «не одобрение» — часть текста, а вот сами карточки программ
    // не должны нести ни вердикта банка, ни вероятности, ни КДН.
    const items = JSON.stringify(r.items);
    expect(items).not.toMatch(/одобрен|вероятность|КДН/i);
  });

  it('ставка отдаётся диапазоном и с ГЭСВ — одна нижняя граница вводит в заблуждение', async () => {
    const r = await matchPrograms(INPUT);
    const market = r.items.find((i) => i.id === 'p_market')!;
    expect(market.ratePercentFrom).toBe('20.5');
    expect(market.ratePercentTo).toBe('24');
    expect(market.aprFrom).toBe('23');
  });

  it('фильтр по типу жилья доходит до запроса', async () => {
    await matchPrograms({ ...INPUT, propertyType: 'SECONDARY' });
    expect(db.mortgageProgram.findMany.mock.calls[0][0].where.propertyType).toBe('SECONDARY');
  });
});
