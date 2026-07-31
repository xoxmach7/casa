import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    customField: { findFirst: vi.fn(), create: vi.fn() },
    customFieldValue: { create: vi.fn(), createMany: vi.fn() },
    seller: { findMany: vi.fn(), create: vi.fn() },
    client: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { executeImport } from '../services/import.service';

describe('executeImport — unmapped custom field values', () => {
  beforeEach(() => vi.clearAllMocks());

  it('batches all unmapped custom field values into one createMany instead of one create per row/column', async () => {
    (prisma.seller.findMany as any).mockResolvedValue([]);
    (prisma.customField.findFirst as any).mockResolvedValue(null);
    (prisma.customField.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `field_${data.name}`, ...data })
    );
    (prisma.seller.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `seller_${data.phone}`, ...data })
    );
    (prisma.customFieldValue.createMany as any).mockResolvedValue({ count: 4 });

    const rows = [
      { Телефон: '+7 700 111 1111', Источник: 'Instagram' },
      { Телефон: '+7 700 222 2222', Источник: 'Facebook' },
    ];

    const result = await executeImport({
      rows,
      columnMapping: { Телефон: 'phone' },
      targetModel: 'seller',
      stageMapping: {},
      brokerId: 'broker_1',
    });

    expect(result.created).toBe(2);
    expect(result.errors).toBe(0);

    // One createMany call for all unmapped custom field values across all rows,
    // never a per-row/per-column `create`.
    expect(prisma.customFieldValue.create).not.toHaveBeenCalled();
    expect(prisma.customFieldValue.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.customFieldValue.createMany).toHaveBeenCalledWith({
      data: [
        { fieldId: 'field_Источник', sellerId: 'seller_+77001111111', value: 'Instagram' },
        { fieldId: 'field_Источник', sellerId: 'seller_+77002222222', value: 'Facebook' },
      ],
    });
  });

  it('does not call createMany when there are no unmapped columns with values', async () => {
    (prisma.seller.findMany as any).mockResolvedValue([]);
    (prisma.seller.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `seller_${data.phone}`, ...data })
    );

    const rows = [{ Телефон: '+7 700 333 3333' }];

    await executeImport({
      rows,
      columnMapping: { Телефон: 'phone' },
      targetModel: 'seller',
      stageMapping: {},
      brokerId: 'broker_1',
    });

    expect(prisma.customField.findFirst).not.toHaveBeenCalled();
    expect(prisma.customFieldValue.createMany).not.toHaveBeenCalled();
  });
});
