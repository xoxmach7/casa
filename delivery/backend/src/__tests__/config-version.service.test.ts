import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    configVersion: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { getActiveConfigValue } from '../lib/config-version.service';

describe('getActiveConfigValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no version matches', async () => {
    (prisma.configVersion.findFirst as any).mockResolvedValue(null);

    const result = await getActiveConfigValue('valuation.modifiers.almaty');

    expect(result).toBeNull();
  });

  it('queries for the version effective at the given date, scoped and active-only', async () => {
    (prisma.configVersion.findFirst as any).mockResolvedValue({ value: { baseModifier: 1.05 } });

    const at = new Date('2026-08-01T00:00:00Z');
    const result = await getActiveConfigValue('valuation.modifiers.almaty', { scope: 'almaty', at });

    expect(prisma.configVersion.findFirst).toHaveBeenCalledWith({
      where: {
        key: 'valuation.modifiers.almaty',
        scope: 'almaty',
        isActive: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    expect(result).toEqual({ baseModifier: 1.05 });
  });
});
