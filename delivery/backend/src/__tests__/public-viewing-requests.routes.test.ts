import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findFirst: vi.fn() },
    viewingRequest: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicViewingRequestsRouter } from '../routes/public-viewing-requests.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/viewing-requests', publicViewingRequestsRouter);
  return app;
}

describe('POST /api/public/viewing-requests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400s on missing fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/public/viewing-requests').send({ propertyId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .post('/api/public/viewing-requests')
      .send({ propertyId: 'missing', name: 'Аружан', phone: '+77001234567' });
    expect(res.status).toBe(404);
  });

  it('creates a viewing request for an existing property', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue({ id: 'p1' });
    (prisma.viewingRequest.create as any).mockResolvedValue({ id: 'vr_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/public/viewing-requests')
      .send({ propertyId: 'p1', name: 'Аружан', phone: '+77001234567' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(prisma.viewingRequest.create).toHaveBeenCalledWith({
      data: { propertyId: 'p1', name: 'Аружан', phone: '+77001234567' },
    });
  });

  it('only looks up properties that are actually published and active', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    await request(app)
      .post('/api/public/viewing-requests')
      .send({ propertyId: 'draft_1', name: 'Аружан', phone: '+77001234567' });

    expect(prisma.crmProperty.findFirst).toHaveBeenCalledWith({
      where: { id: 'draft_1', funnelStage: 'LEADS', publishedAt: { not: null }, status: 'ACTIVE' },
    });
  });
});
