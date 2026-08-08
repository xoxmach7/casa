import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    landingLead: { create: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicLandingLeadsRouter } from '../routes/public-landing-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/landing-leads', publicLandingLeadsRouter);
  return app;
}

const VALID_BODY = {
  name: 'Аружан Смагулова',
  phone: '+77001234567',
  role: 'Риелтор / брокер',
  source: 'gpt-taste',
};

describe('POST /api/public/landing-leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/landing-leads').send({ name: 'Аружан' });
    expect(res.status).toBe(400);
  });

  it('creates a NEW landing lead and notifies every admin', async () => {
    (prisma.landingLead.create as any).mockResolvedValue({ id: 'lead_1' });
    (prisma.user.findMany as any).mockResolvedValue([{ id: 'admin_1' }, { id: 'admin_2' }]);
    (prisma.notification.createMany as any).mockResolvedValue({ count: 2 });

    const app = buildApp();
    const res = await request(app).post('/api/public/landing-leads').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, id: 'lead_1' });

    expect(prisma.landingLead.create).toHaveBeenCalledWith({
      data: {
        name: 'Аружан Смагулова',
        phone: '+77001234567',
        role: 'Риелтор / брокер',
        source: 'gpt-taste',
      },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'admin_1', title: 'Новая заявка с лендинга' }),
        expect.objectContaining({ userId: 'admin_2', title: 'Новая заявка с лендинга' }),
      ],
    });
  });

  it('defaults source to "landing" when omitted', async () => {
    (prisma.landingLead.create as any).mockResolvedValue({ id: 'lead_2' });
    (prisma.user.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const { source, ...withoutSource } = VALID_BODY;
    const res = await request(app).post('/api/public/landing-leads').send(withoutSource);

    expect(res.status).toBe(200);
    expect(prisma.landingLead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'landing' }) })
    );
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
