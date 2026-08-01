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
        res.status(403).json({ message: 'Доступ запрещен' });
        return;
      }
      next();
    },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    client: { count: vi.fn() },
    deal: { count: vi.fn() },
    booking: { count: vi.fn() },
  },
}));

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { usersRouter } from '../routes/users.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRouter);
  return app;
}

describe('GET /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it("returns only the requesting user's own profile", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'broker_1', email: 'broker@casa.kz' });

    const app = buildApp();
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'broker_1' } })
    );
  });
});

describe('PUT /api/users/me/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('rejects a change when the current password is wrong', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'broker_1', password: 'hashed' });
    (bcrypt.compare as any).mockResolvedValue(false);

    const app = buildApp();
    const res = await request(app)
      .put('/api/users/me/password')
      .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates the password when the current password matches', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'broker_1', password: 'hashed' });
    (bcrypt.compare as any).mockResolvedValue(true);
    (bcrypt.hash as any).mockResolvedValue('new-hashed');
    (prisma.user.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .put('/api/users/me/password')
      .send({ currentPassword: 'correct', newPassword: 'newpass123' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'broker_1' },
      data: { password: 'new-hashed' },
    });
  });
});

describe('GET /api/users (admin list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s for a non-admin', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('allows ADMIN to list users', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.user.findMany as any).mockResolvedValue([]);
    (prisma.user.count as any).mockResolvedValue(0);

    const app = buildApp();
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(200);
  });
});

describe('POST /api/users (admin create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s for a non-admin trying to create a user', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'new@casa.kz', password: 'pass1234', firstName: 'A', lastName: 'B', role: 'BROKER' });

    expect(res.status).toBe(403);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('400s when the email is already taken', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'taken@casa.kz', password: 'pass1234', firstName: 'A', lastName: 'B', role: 'BROKER' });

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
