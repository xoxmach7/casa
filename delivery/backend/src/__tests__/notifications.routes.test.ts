import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'dev_1', role: 'DEVELOPER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    notification: { findMany: vi.fn(), count: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { notificationsRouter } from '../routes/notifications.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
  return app;
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.notification.count as any).mockResolvedValue(0);
  });

  it('clamps an oversized limit to the max page size', async () => {
    (prisma.notification.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/notifications?limit=1000000');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('enriches BOOKING notifications with broker contact using a single bulk booking query', async () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    (prisma.notification.findMany as any).mockResolvedValue([
      { id: 'n1', type: 'BOOKING', createdAt: now, userId: 'dev_1' },
      { id: 'n2', type: 'BOOKING', createdAt: new Date(now.getTime() + 3600_000), userId: 'dev_1' },
      { id: 'n3', type: 'SYSTEM', createdAt: now, userId: 'dev_1' },
    ]);
    (prisma.booking.findMany as any).mockResolvedValue([
      {
        id: 'b1',
        createdAt: new Date(now.getTime() + 10_000),
        broker: { firstName: 'Ivan', lastName: 'Petrov', phone: '+7700', email: 'ivan@test.kz' },
      },
    ]);

    const app = buildApp();
    const res = await request(app).get('/api/notifications');

    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(res.body.notifications[0].brokerName).toBe('Ivan Petrov');
    // n2 is far from the only booking (>60s) -> not enriched
    expect(res.body.notifications[1].brokerName).toBeUndefined();
    // non-BOOKING notification untouched
    expect(res.body.notifications[2].brokerName).toBeUndefined();
  });

  it('does not query bookings for non-developer roles', async () => {
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    (prisma.notification.findMany as any).mockResolvedValue([
      { id: 'n1', type: 'BOOKING', createdAt: new Date(), userId: 'broker_1' },
    ]);

    const app = buildApp();
    await request(app).get('/api/notifications');

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
