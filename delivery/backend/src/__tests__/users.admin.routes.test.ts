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

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { usersAdminRouter } from '../routes/users.admin.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', usersAdminRouter);
  return app;
}

function newUserBody(role: string) {
  return {
    email: `${role.toLowerCase()}@casa.kz`,
    password: 'secret123',
    firstName: 'Айгуль',
    lastName: 'Сериковна',
    role,
  };
}

describe('POST /api/admin/users — assignable roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user_new', ...data })
    );
  });

  // The secondary-market contour is useless if nobody can be given its roles:
  // the modules would stay ADMIN-only in practice even though the guards allow
  // COORDINATOR/ANALYST.
  it.each(['COORDINATOR', 'ANALYST'])('creates a %s', async (role) => {
    const app = buildApp();
    const res = await request(app).post('/api/admin/users').send(newUserBody(role));

    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role }) })
    );
  });

  it.each(['BROKER', 'DEVELOPER', 'AGENCY', 'ADMIN'])('still creates a %s', async (role) => {
    const app = buildApp();
    const res = await request(app).post('/api/admin/users').send(newUserBody(role));
    expect(res.status).toBe(201);
  });

  it('rejects a role that does not exist in the schema', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/admin/users').send(newUserBody('SUPERUSER'));

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('still requires an agency for a realtor', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/admin/users').send(newUserBody('REALTOR'));

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('403s a non-admin', async () => {
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    const app = buildApp();
    const res = await request(app).post('/api/admin/users').send(newUserBody('COORDINATOR'));

    expect(res.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/users/:id — role changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user_1', email: 'a@casa.kz', role: 'BROKER' });
    (prisma.user.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'user_1', ...data })
    );
  });

  it('promotes an existing user to COORDINATOR', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/admin/users/user_1').send({ role: 'COORDINATOR' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'COORDINATOR' }) })
    );
  });

  it('rejects an unknown role on update too', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/admin/users/user_1').send({ role: 'SUPERUSER' });

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
