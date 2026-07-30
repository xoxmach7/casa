import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'admin_1', role: 'ADMIN' };
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
    client: { findMany: vi.fn() },
    crmProperty: { findMany: vi.fn() },
    apartment: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    fixation: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { searchRouter } from '../routes/search.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/search', searchRouter);
  return app;
}

describe('GET /api/admin/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty results for a too-short query without hitting the DB', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/search?q=a');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ clients: [], properties: [], apartments: [], projects: [], fixations: [] });
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it('searches all five entity types in parallel and returns their results', async () => {
    (prisma.client.findMany as any).mockResolvedValue([{ id: 'client_1' }]);
    (prisma.crmProperty.findMany as any).mockResolvedValue([{ id: 'prop_1' }]);
    (prisma.apartment.findMany as any).mockResolvedValue([{ id: 'apt_1' }]);
    (prisma.project.findMany as any).mockResolvedValue([{ id: 'proj_1' }]);
    (prisma.fixation.findMany as any).mockResolvedValue([{ id: 'fix_1' }]);

    const app = buildApp();
    const res = await request(app).get('/api/admin/search?q=Ержан');

    expect(res.status).toBe(200);
    expect(res.body.clients).toEqual([{ id: 'client_1' }]);
    expect(res.body.properties).toEqual([{ id: 'prop_1' }]);
    expect(res.body.apartments).toEqual([{ id: 'apt_1' }]);
    expect(res.body.projects).toEqual([{ id: 'proj_1' }]);
    expect(res.body.fixations).toEqual([{ id: 'fix_1' }]);
  });
});
