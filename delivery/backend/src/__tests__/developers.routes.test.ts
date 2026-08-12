import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: any = { userId: 'admin_1', role: 'ADMIN' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!roles.includes(req.user?.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { developersRouter } from '../routes/developers.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/developers', developersRouter);
  return app;
}

describe('developers admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('lists developers filtered by status', async () => {
    (prisma.user.findMany as any).mockResolvedValue([{ id: 'd1', status: 'PENDING' }]);
    const res = await request(buildApp()).get('/api/admin/developers?status=PENDING');
    expect(res.status).toBe(200);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'DEVELOPER', status: 'PENDING' } }),
    );
  });

  it('ignores an invalid status filter (lists all developers)', async () => {
    (prisma.user.findMany as any).mockResolvedValue([]);
    await request(buildApp()).get('/api/admin/developers?status=HACK');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'DEVELOPER' } }),
    );
  });

  it('approve sets ACTIVE + isActive and notifies the developer', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'd1', role: 'DEVELOPER' });
    (prisma.user.update as any).mockResolvedValue({ id: 'd1', status: 'ACTIVE' });
    const res = await request(buildApp()).post('/api/admin/developers/d1/approve');
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: { status: 'ACTIVE', isActive: true } }),
    );
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it('reject sets REJECTED + isActive false', async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: 'd1', role: 'DEVELOPER' });
    (prisma.user.update as any).mockResolvedValue({ id: 'd1', status: 'REJECTED' });
    const res = await request(buildApp()).post('/api/admin/developers/d1/reject');
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED', isActive: false } }),
    );
  });

  it('returns 404 when the developer does not exist', async () => {
    (prisma.user.findFirst as any).mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/admin/developers/xxx/approve');
    expect(res.status).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks non-admin roles', async () => {
    currentUser = { userId: 'b1', role: 'BROKER' };
    const res = await request(buildApp()).get('/api/admin/developers');
    expect(res.status).toBe(403);
  });
});
