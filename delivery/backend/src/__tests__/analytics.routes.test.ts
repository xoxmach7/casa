import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { count: vi.fn() },
    apartment: { count: vi.fn() },
    booking: { count: vi.fn() },
    crmProperty: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    buyer: { count: vi.fn().mockResolvedValue(0) },
    offer: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from '../lib/prisma';
import { analyticsRouter } from '../routes/analytics.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  return app;
}

describe('GET /api/analytics/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.crmProperty.count as any).mockResolvedValue(0);
    (prisma.crmProperty.findMany as any).mockResolvedValue([]);
    (prisma.crmProperty.groupBy as any).mockResolvedValue([]);
    (prisma.buyer.count as any).mockResolvedValue(0);
    (prisma.offer.findMany as any).mockResolvedValue([]);
    (prisma.user.findMany as any).mockResolvedValue([]);
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('scopes every crmProperty query to the requesting broker', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.status).toBe(200);
    for (const call of (prisma.crmProperty.count as any).mock.calls) {
      expect(call[0].where).toMatchObject({ brokerId: 'broker_1' });
    }
    for (const call of (prisma.crmProperty.findMany as any).mock.calls) {
      expect(call[0].where).toMatchObject({ brokerId: 'broker_1' });
    }
  });

  it('does not include brokersPerformance for a BROKER', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.body.brokersPerformance).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('includes brokersPerformance built from one bulk query for ADMIN', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.user.findMany as any).mockResolvedValue([
      { id: 'broker_1', firstName: 'A', lastName: 'B', email: 'a@casa.kz' },
    ]);
    (prisma.crmProperty.findMany as any).mockImplementation((args: any) => {
      if (args.select?.brokerId !== undefined) {
        return Promise.resolve([{ brokerId: 'broker_1', status: 'ACTIVE', funnelStage: 'DEAL', price: 1000000 }]);
      }
      return Promise.resolve([]);
    });

    const app = buildApp();
    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.brokersPerformance).toHaveLength(1);
    expect(res.body.brokersPerformance[0].totalProperties).toBe(1);
    // one bulk findMany for broker-performance, not one call per broker
    expect(
      (prisma.crmProperty.findMany as any).mock.calls.filter(
        (c: any) => c[0].select?.brokerId !== undefined
      )
    ).toHaveLength(1);
  });

  it('returns the developer-shaped dashboard for a DEVELOPER, scoped by developerId', async () => {
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.project.count as any).mockResolvedValue(3);
    (prisma.apartment.count as any).mockResolvedValue(12);
    (prisma.booking.count as any).mockResolvedValue(4);

    const app = buildApp();
    const res = await request(app).get('/api/analytics/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.kpi).toEqual({
      activeDeals: 3,
      commissionForecast: 12,
      hotLeads: 4,
      conversionRate: 0,
    });
    expect(prisma.project.count).toHaveBeenCalledWith({ where: { developerId: 'dev_1' } });
    expect(prisma.crmProperty.findMany).not.toHaveBeenCalled();
  });
});
