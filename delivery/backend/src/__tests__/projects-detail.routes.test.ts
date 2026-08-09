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

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    apartment: { groupBy: vi.fn() },
    fixation: { count: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { projectsRouter } from '../routes/projects.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
  return app;
}

const PROJECT = {
  id: 'proj_1',
  developerId: 'dev_1',
  apartments: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
};

describe('GET /api/projects/:id — apartment stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.project.findUnique as any).mockResolvedValue(PROJECT);
    (prisma.apartment.groupBy as any).mockResolvedValue([
      { status: 'AVAILABLE', _count: 2 },
      { status: 'RESERVED', _count: 1 },
    ]);
    (prisma.fixation.count as any).mockResolvedValue(0);
  });

  it('counts fixations from Fixation, not from RESERVED apartments', async () => {
    // A booked apartment and a live fixation are different things: booking
    // flips Apartment.status, fixation holds the client for the broker.
    (prisma.fixation.count as any).mockResolvedValue(5);

    const app = buildApp();
    const res = await request(app).get('/api/projects/proj_1');

    expect(res.status).toBe(200);
    expect(res.body.apartmentStats.activeFixations).toBe(5);
    expect(res.body.apartmentStats.reserved).toBe(1);
  });

  it('counts only live fixations — drafts, rejections and expiries do not hold a client', async () => {
    const app = buildApp();
    await request(app).get('/api/projects/proj_1');

    expect(prisma.fixation.count).toHaveBeenCalledWith({
      where: {
        projectId: 'proj_1',
        status: { in: ['SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'BOOKING_REQUESTED', 'BOOKED'] },
      },
    });
  });

  it('reports zero fixations rather than omitting the field', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/projects/proj_1');
    expect(res.body.apartmentStats.activeFixations).toBe(0);
  });

  it('404s an unknown project', async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);
    const app = buildApp();
    expect((await request(app).get('/api/projects/missing')).status).toBe(404);
  });

  it("403s a developer looking at someone else's project", async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    const app = buildApp();
    const res = await request(app).get('/api/projects/proj_1');
    expect(res.status).toBe(403);
  });
});
