import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

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

vi.mock('../lib/prisma', () => ({
  prisma: {
    booking: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    apartment: { findUnique: vi.fn(), update: vi.fn() },
    client: { findUnique: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
  },
}));

import { prisma } from '../lib/prisma';
import { bookingsRouter } from '../routes/bookings.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingsRouter);
  return app;
}

describe('GET /api/bookings/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when the booking belongs to a different broker', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking_1',
      brokerId: 'broker_2',
      status: 'CONFIRMED',
      apartmentId: 'apt_1',
      apartment: { project: { developerId: 'dev_1' } },
    });

    const app = buildApp();
    const res = await request(app).get('/api/bookings/booking_1');

    expect(res.status).toBe(403);
  });

  it('403s for a developer who does not own the apartment project (regression: this endpoint previously had no developer scoping)', async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking_1',
      brokerId: 'broker_1',
      status: 'CONFIRMED',
      apartmentId: 'apt_1',
      apartment: { project: { developerId: 'dev_1' } },
    });

    const app = buildApp();
    const res = await request(app).get('/api/bookings/booking_1');

    expect(res.status).toBe(403);
  });

  it('allows the owning developer to view the booking', async () => {
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking_1',
      brokerId: 'broker_1',
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 86400000),
      apartmentId: 'apt_1',
      apartment: { project: { developerId: 'dev_1' } },
    });

    const app = buildApp();
    const res = await request(app).get('/api/bookings/booking_1');

    expect(res.status).toBe(200);
  });

  it('404s when the booking does not exist', async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/bookings/missing');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/bookings/:id/complete-deal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it("403s for a developer who does not own the booking's project (regression: previously any developer could complete any deal)", async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking_1',
      brokerId: 'broker_1',
      clientId: 'client_1',
      apartmentId: 'apt_1',
      status: 'CONFIRMED',
      client: {},
      apartment: { projectId: 'proj_1', number: '12' },
    });
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });

    const app = buildApp();
    const res = await request(app).post('/api/bookings/booking_1/complete-deal');

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows the owning developer to complete the deal', async () => {
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.booking.findUnique as any)
      .mockResolvedValueOnce({
        id: 'booking_1',
        brokerId: 'broker_1',
        clientId: 'client_1',
        apartmentId: 'apt_1',
        status: 'CONFIRMED',
        client: {},
        apartment: { projectId: 'proj_1', number: '12' },
      })
      .mockResolvedValueOnce({
        id: 'booking_1',
        client: { status: 'DEAL_CLOSED' },
        apartment: { status: 'SOLD', project: { id: 'proj_1', name: 'ЖК' } },
      });
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });

    const app = buildApp();
    const res = await request(app).post('/api/bookings/booking_1/complete-deal');

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('400s when the booking is not CONFIRMED', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 'booking_1',
      brokerId: 'broker_1',
      clientId: 'client_1',
      apartmentId: 'apt_1',
      status: 'PENDING',
      client: {},
      apartment: { projectId: 'proj_1', number: '12' },
    });

    const app = buildApp();
    const res = await request(app).post('/api/bookings/booking_1/complete-deal');

    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it("403s when creating a booking for a client that isn't the broker's own", async () => {
    (prisma.apartment.findUnique as any).mockResolvedValue({ id: 'apt_1', status: 'AVAILABLE' });
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/bookings')
      .send({ clientId: 'client_1', apartmentId: 'apt_1' });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('400s when the apartment is not AVAILABLE', async () => {
    (prisma.apartment.findUnique as any).mockResolvedValue({ id: 'apt_1', status: 'SOLD' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/bookings')
      .send({ clientId: 'client_1', apartmentId: 'apt_1' });

    expect(res.status).toBe(400);
  });
});
