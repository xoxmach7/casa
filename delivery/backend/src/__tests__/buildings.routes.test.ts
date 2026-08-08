import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'admin_1', role: 'ADMIN' };

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
    building: { findMany: vi.fn(), create: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { buildingsRouter } from '../routes/buildings.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/buildings', buildingsRouter);
  return app;
}

describe('GET /api/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('filters by projectId when given', async () => {
    (prisma.building.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/buildings?projectId=proj_1');

    expect(prisma.building.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj_1' } })
    );
  });
});

describe('POST /api/buildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('403s a BROKER', async () => {
    currentUser = { userId: 'broker_1', role: 'BROKER' };

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(403);
    expect(prisma.building.create).not.toHaveBeenCalled();
  });

  it('creates a building for ADMIN', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });
    (prisma.building.create as any).mockResolvedValue({ id: 'b_1', name: 'Блок C', projectId: 'proj_1' });

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(201);
    expect(prisma.building.create).toHaveBeenCalledWith({ data: { name: 'Блок C', projectId: 'proj_1' } });
  });

  it('404s when the project does not exist', async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'missing' });

    expect(res.status).toBe(404);
  });

  it("403s a DEVELOPER creating a building on someone else's project", async () => {
    currentUser = { userId: 'dev_2', role: 'DEVELOPER' };
    (prisma.project.findUnique as any).mockResolvedValue({ id: 'proj_1', developerId: 'dev_1' });

    const app = buildApp();
    const res = await request(app).post('/api/buildings').send({ name: 'Блок C', projectId: 'proj_1' });

    expect(res.status).toBe(403);
    expect(prisma.building.create).not.toHaveBeenCalled();
  });
});
