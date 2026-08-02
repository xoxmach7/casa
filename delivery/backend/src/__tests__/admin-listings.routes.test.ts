import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } = { userId: 'admin_1', role: 'ADMIN' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('../lib/audit-log.service', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    publicListingOps: { upsert: vi.fn(), update: vi.fn() },
    publicListingLead: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { adminListingsRouter } from '../routes/admin-listings.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/listings', adminListingsRouter);
  return app;
}

describe('admin-listings.routes — access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s a non-admin', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/listings');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('returns properties with ops and leads included', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([{ id: 'p1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/admin/listings');

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ publicListingOps: true, publicListingLeads: expect.anything() }),
      })
    );
  });
});

describe('POST /api/admin/listings/:id/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/admin/listings/missing/status').send({ status: 'PUBLISHED' });

    expect(res.status).toBe(404);
  });

  it('400s an invalid status value', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1', status: 'MODERATION', publishedAt: null });

    const app = buildApp();
    const res = await request(app).post('/api/admin/listings/p1/status').send({ status: 'BOGUS' });

    expect(res.status).toBe(400);
  });

  it('publishes a listing and stamps publishedAt on the underlying CrmProperty', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1', status: 'MODERATION', publishedAt: null });
    (prisma.publicListingOps.upsert as any).mockResolvedValue({ id: 'ops_1', propertyId: 'p1' });
    (prisma.publicListingOps.update as any).mockResolvedValue({ id: 'ops_1', status: 'PUBLISHED' });
    (prisma.crmProperty.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/admin/listings/p1/status').send({ status: 'PUBLISHED' });

    expect(res.status).toBe(200);
    expect(prisma.publicListingOps.update).toHaveBeenCalledWith({
      where: { propertyId: 'p1' },
      data: expect.objectContaining({ status: 'PUBLISHED' }),
    });
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ publishedAt: expect.any(Date) }),
    });
  });

  it('archives a listing and archives the underlying CrmProperty status too', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1', status: 'ACTIVE', publishedAt: new Date() });
    (prisma.publicListingOps.upsert as any).mockResolvedValue({ id: 'ops_1', propertyId: 'p1' });
    (prisma.publicListingOps.update as any).mockResolvedValue({ id: 'ops_1', status: 'ARCHIVED' });
    (prisma.crmProperty.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).post('/api/admin/listings/p1/status').send({ status: 'ARCHIVED' });

    expect(res.status).toBe(200);
    expect(prisma.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ status: 'ARCHIVED' }),
    });
  });
});

describe('POST /api/admin/listings/:id/payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/admin/listings/missing/payment').send({ paymentAmount: 100000 });

    expect(res.status).toBe(404);
  });

  it('marks the ops record PAID with amount and receipt', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.publicListingOps.upsert as any).mockResolvedValue({ id: 'ops_1', propertyId: 'p1' });
    (prisma.publicListingOps.update as any).mockResolvedValue({ id: 'ops_1', paymentStatus: 'PAID' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/listings/p1/payment')
      .send({ paymentAmount: 150000, paymentReceiptFileId: 'file_1' });

    expect(res.status).toBe(200);
    expect(prisma.publicListingOps.update).toHaveBeenCalledWith({
      where: { propertyId: 'p1' },
      data: expect.objectContaining({ paymentStatus: 'PAID', paymentAmount: 150000, paymentReceiptFileId: 'file_1' }),
    });
  });
});

describe('POST /api/admin/listings/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the property does not exist', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/listings/leads')
      .send({ propertyId: 'missing', buyerName: 'Aida', buyerPhone: '+77001112233' });

    expect(res.status).toBe(404);
  });

  it('creates a lead manually', async () => {
    (prisma.crmProperty.findUnique as any).mockResolvedValue({ id: 'p1' });
    (prisma.publicListingLead.create as any).mockResolvedValue({ id: 'lead_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/admin/listings/leads')
      .send({ propertyId: 'p1', buyerName: 'Aida', buyerPhone: '+77001112233' });

    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/admin/listings/leads/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('404s when the lead does not exist', async () => {
    (prisma.publicListingLead.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).patch('/api/admin/listings/leads/missing').send({ financingType: 'mortgage' });

    expect(res.status).toBe(404);
  });

  it('updates financing/viewing fields on an existing lead', async () => {
    (prisma.publicListingLead.findUnique as any).mockResolvedValue({ id: 'lead_1' });
    (prisma.publicListingLead.update as any).mockResolvedValue({ id: 'lead_1', financingType: 'mortgage' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/admin/listings/leads/lead_1')
      .send({ financingType: 'mortgage', financingBank: 'Halyk', preApproved: true });

    expect(res.status).toBe(200);
    expect(prisma.publicListingLead.update).toHaveBeenCalledWith({
      where: { id: 'lead_1' },
      data: expect.objectContaining({ financingType: 'mortgage', financingBank: 'Halyk', preApproved: true }),
    });
  });
});
