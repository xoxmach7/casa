import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findMany: vi.fn(), findFirst: vi.fn() },
    apartment: { findMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicProjectsRouter } from '../routes/public-projects.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/projects', publicProjectsRouter);
  return app;
}

describe('GET /api/public/projects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only queries published projects and computes price range from available apartments', async () => {
    (prisma.project.findMany as any).mockResolvedValue([
      {
        id: 'proj_1',
        name: 'ЖК Test',
        apartments: [
          { price: '30000000', status: 'AVAILABLE' },
          { price: '40000000', status: 'AVAILABLE' },
          { price: '20000000', status: 'SOLD' },
        ],
      },
    ]);

    const app = buildApp();
    const res = await request(app).get('/api/public/projects');

    expect(res.status).toBe(200);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } })
    );
    expect(res.body.projects[0].minPrice).toBe(30000000);
    expect(res.body.projects[0].maxPrice).toBe(40000000);
    expect(res.body.projects[0].availableApartments).toBe(2);
    expect(res.body.projects[0].apartments).toBeUndefined();
  });
});

describe('GET /api/public/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s for an unpublished or missing project', async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/public/projects/proj_1');

    expect(res.status).toBe(404);
    expect(prisma.apartment.findMany).not.toHaveBeenCalled();
  });

  it('returns the project with only AVAILABLE apartments', async () => {
    (prisma.project.findFirst as any).mockResolvedValue({ id: 'proj_1', name: 'ЖК Test' });
    (prisma.apartment.findMany as any).mockResolvedValue([
      { id: 'apt_1', price: '30000000', area: '61.5', status: 'AVAILABLE' },
    ]);

    const app = buildApp();
    const res = await request(app).get('/api/public/projects/proj_1');

    expect(res.status).toBe(200);
    expect(prisma.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj_1', status: 'AVAILABLE' } })
    );
    expect(res.body.apartments[0].price).toBe(30000000);
    expect(res.body.apartments[0].area).toBe(61.5);
  });
});
