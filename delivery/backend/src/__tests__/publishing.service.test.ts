import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishProperty, unpublishProperty } from '../services/publishing.service';

vi.mock('../services/matching.service', () => ({
  matchBuyersToProperty: vi.fn().mockResolvedValue(0),
}));

import { matchBuyersToProperty } from '../services/matching.service';

function buildProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    publishedAt: null,
    district: 'Бостандыкский',
    rooms: 2,
    residentialComplex: 'Comfort City',
    price: 36_000_000,
    ...overrides,
  } as any;
}

function buildTx(property: any) {
  return {
    crmProperty: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(property),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...property, ...data })),
    },
  } as any;
}

describe('publishProperty', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets publishedAt and triggers buyer matching when not yet published', async () => {
    const property = buildProperty();
    const tx = buildTx(property);

    const result = await publishProperty(tx, 'prop_1');

    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(tx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { publishedAt: expect.any(Date) },
    });
    expect(matchBuyersToProperty).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when already published', async () => {
    const publishedAt = new Date('2026-01-01');
    const property = buildProperty({ publishedAt });
    const tx = buildTx(property);

    const result = await publishProperty(tx, 'prop_1');

    expect(result.publishedAt).toBe(publishedAt);
    expect(tx.crmProperty.update).not.toHaveBeenCalled();
    expect(matchBuyersToProperty).not.toHaveBeenCalled();
  });
});

describe('unpublishProperty', () => {
  it('clears publishedAt', async () => {
    const property = buildProperty({ publishedAt: new Date() });
    const tx = buildTx(property);

    const result = await unpublishProperty(tx, 'prop_1');

    expect(result.publishedAt).toBeNull();
    expect(tx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { publishedAt: null },
    });
  });
});
