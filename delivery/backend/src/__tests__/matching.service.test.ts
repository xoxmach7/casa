import { describe, it, expect, vi } from 'vitest';
import { matchBuyersToProperty } from '../services/matching.service';

function buildProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    district: 'Бостандыкский',
    rooms: 2,
    residentialComplex: 'Comfort City',
    price: 36_000_000,
    ...overrides,
  } as any;
}

function buildBuyer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'buyer_1',
    firstName: 'Аружан',
    brokerId: 'broker_1',
    status: 'ACTIVE',
    minBudget: null,
    maxBudget: null,
    preferences: null,
    ...overrides,
  } as any;
}

function buildTx(buyers: any[]) {
  return {
    buyer: { findMany: vi.fn().mockResolvedValue(buyers) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  } as any;
}

describe('matchBuyersToProperty', () => {
  it('notifies the broker of a buyer whose budget range covers the property price', async () => {
    const tx = buildTx([buildBuyer({ minBudget: 30_000_000, maxBudget: 40_000_000 })]);

    const count = await matchBuyersToProperty(tx, buildProperty());

    expect(count).toBe(1);
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'broker_1', type: 'SYSTEM' }),
      })
    );
  });

  it('skips a buyer whose max budget is below the property price', async () => {
    const tx = buildTx([buildBuyer({ maxBudget: 20_000_000 })]);

    const count = await matchBuyersToProperty(tx, buildProperty());

    expect(count).toBe(0);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('skips a buyer whose preferred district does not match', async () => {
    const tx = buildTx([buildBuyer({ preferences: { district: 'Медеуский' } })]);

    const count = await matchBuyersToProperty(tx, buildProperty());

    expect(count).toBe(0);
  });

  it('skips a buyer whose preferred room count does not include the property', async () => {
    const tx = buildTx([buildBuyer({ preferences: { rooms: [3, 4] } })]);

    const count = await matchBuyersToProperty(tx, buildProperty({ rooms: 2 }));

    expect(count).toBe(0);
  });

  it('matches a buyer with no budget or preferences set (open criteria)', async () => {
    const tx = buildTx([buildBuyer()]);

    const count = await matchBuyersToProperty(tx, buildProperty());

    expect(count).toBe(1);
  });
});
