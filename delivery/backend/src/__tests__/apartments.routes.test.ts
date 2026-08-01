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
    apartment: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { apartmentsRouter } from '../routes/apartments.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/apartments', apartmentsRouter);
  return app;
}

const BOOKING = {
  id: 'booking_1',
  status: 'CONFIRMED',
  expiresAt: new Date(),
  brokerId: 'broker_2',
  client: { firstName: 'Клиент', lastName: 'Чужой', phone: '+77001112233' },
};

describe('GET /api/apartments — booking contact redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('strips client contact details from a booking that belongs to a different broker', async () => {
    (prisma.apartment.findMany as any).mockResolvedValue([
      {
        id: 'apt_1',
        project: { id: 'proj_1', name: 'ЖК', city: 'Astana', address: 'ул. Х', developerId: 'dev_1' },
        bookings: [BOOKING],
      },
    ]);
    (prisma.apartment.count as any).mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app).get('/api/apartments');

    expect(res.status).toBe(200);
    const booking = res.body.apartments[0].bookings[0];
    expect(booking.client).toBeUndefined();
    expect(booking.brokerId).toBeUndefined();
    expect(booking.status).toBe('CONFIRMED');
  });

  it('keeps client contact details for the broker who owns the booking', async () => {
    currentUser = { userId: 'broker_2', role: 'BROKER' };
    (prisma.apartment.findMany as any).mockResolvedValue([
      {
        id: 'apt_1',
        project: { id: 'proj_1', name: 'ЖК', city: 'Astana', address: 'ул. Х', developerId: 'dev_1' },
        bookings: [BOOKING],
      },
    ]);
    (prisma.apartment.count as any).mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app).get('/api/apartments');

    expect(res.body.apartments[0].bookings[0].client).toEqual(BOOKING.client);
  });

  it('keeps client contact details for ADMIN', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.apartment.findMany as any).mockResolvedValue([
      {
        id: 'apt_1',
        project: { id: 'proj_1', name: 'ЖК', city: 'Astana', address: 'ул. Х', developerId: 'dev_1' },
        bookings: [BOOKING],
      },
    ]);
    (prisma.apartment.count as any).mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app).get('/api/apartments');

    expect(res.body.apartments[0].bookings[0].client).toEqual(BOOKING.client);
  });

  it('keeps client contact details for the project-owning developer', async () => {
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.apartment.findMany as any).mockResolvedValue([
      {
        id: 'apt_1',
        project: { id: 'proj_1', name: 'ЖК', city: 'Astana', address: 'ул. Х', developerId: 'dev_1' },
        bookings: [BOOKING],
      },
    ]);
    (prisma.apartment.count as any).mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app).get('/api/apartments');

    expect(res.body.apartments[0].bookings[0].client).toEqual(BOOKING.client);
  });

  it('strips client contact details for an unrelated developer', async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    (prisma.apartment.findMany as any).mockResolvedValue([
      {
        id: 'apt_1',
        project: { id: 'proj_1', name: 'ЖК', city: 'Astana', address: 'ул. Х', developerId: 'dev_1' },
        bookings: [BOOKING],
      },
    ]);
    (prisma.apartment.count as any).mockResolvedValue(1);

    const app = buildApp();
    const res = await request(app).get('/api/apartments');

    expect(res.body.apartments[0].bookings[0].client).toBeUndefined();
  });
});

describe('GET /api/apartments/:id — booking contact redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('strips client/broker contact details for a broker not on the booking', async () => {
    (prisma.apartment.findUnique as any).mockResolvedValue({
      id: 'apt_1',
      project: { id: 'proj_1', developerId: 'dev_1' },
      bookings: [
        {
          ...BOOKING,
          broker: { id: 'broker_2', firstName: 'Другой', lastName: 'Брокер', phone: '+77009998877' },
        },
      ],
    });

    const app = buildApp();
    const res = await request(app).get('/api/apartments/apt_1');

    expect(res.status).toBe(200);
    expect(res.body.bookings[0].client).toBeUndefined();
    expect(res.body.bookings[0].broker).toBeUndefined();
  });

  it('404s when the apartment does not exist', async () => {
    (prisma.apartment.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/apartments/missing');

    expect(res.status).toBe(404);
  });
});
