import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    leadForm: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    seller: { findFirst: vi.fn(), create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicFormsRouter } from '../routes/public-forms.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/forms', publicFormsRouter);
  return app;
}

describe('POST /api/public/forms/:id/submit — structured fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes expectedPrice onto the Seller when the form includes it', async () => {
    (prisma.leadForm.findUnique as any).mockResolvedValue({
      id: 'form_1',
      title: 'Мастер оценки — Алматы',
      isActive: true,
      distributionType: 'ROUND_ROBIN',
      brokers: [{ id: 'broker_1' }],
    });
    (prisma.seller.findFirst as any).mockResolvedValue(null);
    (prisma.seller.create as any).mockResolvedValue({ id: 'seller_1' });
    (prisma.notification.create as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/public/forms/form_1/submit').send({
      name: 'Аружан',
      phone: '+77001234567',
      expectedPrice: '36000000',
    });

    expect(res.status).toBe(200);
    expect(prisma.seller.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedPrice: 36000000,
        }),
      })
    );
  });
});
