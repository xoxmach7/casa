import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// jwt.ts бросает при импорте, если JWT_SECRET не задан. vi.hoisted выполняется
// до импорта auth.routes → jwt.ts, поэтому переменная успевает появиться.
vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
});

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { authRouter } from '../routes/auth.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

const VALID = {
  companyName: 'BI Group',
  bin: '123456789012',
  firstName: 'Иван',
  lastName: 'Петров',
  email: 'dev@bi.kz',
  phone: '+77001112233',
  password: 'secret123',
};

describe('POST /api/auth/register-developer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PENDING, inactive DEVELOPER account', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'd1' });

    const res = await request(buildApp()).post('/api/auth/register-developer').send(VALID);

    expect(res.status).toBe(201);
    const arg = (prisma.user.create as any).mock.calls[0][0].data;
    expect(arg.role).toBe('DEVELOPER');
    expect(arg.status).toBe('PENDING');
    expect(arg.isActive).toBe(false);
    expect(arg.companyName).toBe('BI Group');
    expect(arg.password).not.toBe('secret123'); // хэширован
  });

  it('rejects a duplicate email with 409', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });
    const res = await request(buildApp()).post('/api/auth/register-developer').send(VALID);
    expect(res.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects invalid payload with 400', async () => {
    const res = await request(buildApp())
      .post('/api/auth/register-developer')
      .send({ ...VALID, email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login — developer moderation gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks a PENDING developer with 403 and a clear message', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'd1', email: 'dev@bi.kz', password: 'x', role: 'DEVELOPER', status: 'PENDING', isActive: false,
    });
    const res = await request(buildApp()).post('/api/auth/login').send({ email: 'dev@bi.kz', password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/рассмотрении/i);
  });

  it('blocks a REJECTED developer with 403', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'd1', email: 'dev@bi.kz', password: 'x', role: 'DEVELOPER', status: 'REJECTED', isActive: false,
    });
    const res = await request(buildApp()).post('/api/auth/login').send({ email: 'dev@bi.kz', password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/отклонена/i);
  });

  it('returns generic 401 for an unknown email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await request(buildApp()).post('/api/auth/login').send({ email: 'nobody@x.kz', password: 'secret123' });
    expect(res.status).toBe(401);
  });
});
