import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findFirst: vi.fn() },
    publicListingLead: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicListingLeadsRouter } from '../routes/public-listing-leads.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/listings', publicListingLeadsRouter);
  return app;
}

describe('POST /api/public/listings/:propertyId/leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the property is not published/active', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/listings/prop_1/leads')
      .send({ buyerName: 'Ержан', buyerPhone: '+77001234567' });

    expect(res.status).toBe(404);
    expect(prisma.publicListingLead.create).not.toHaveBeenCalled();
  });

  it('400s when required fields are missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/listings/prop_1/leads').send({});

    expect(res.status).toBe(400);
  });

  it('creates a lead for a live property', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue({ id: 'prop_1' });
    (prisma.publicListingLead.create as any).mockResolvedValue({ id: 'lead_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/listings/prop_1/leads')
      .send({ buyerName: 'Ержан', buyerPhone: '+77001234567' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, leadId: 'lead_1' });
    expect(prisma.publicListingLead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ propertyId: 'prop_1', buyerName: 'Ержан', buyerPhone: '+77001234567' }),
    });
  });
});
