import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  auth: (req: any, _res: any, next: any) => {
    req.user = currentUser;
    next();
  },
}));

const prismaMock = vi.hoisted(() => ({
  payment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    ...prismaMock,
    $transaction: vi.fn(async (callback: any) => callback(prismaMock)),
  },
}));

import { prisma } from '../lib/prisma';
import { paymentsRouter } from '../routes/payments.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  return app;
}

describe('GET /api/payments/my', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('only queries payments scoped to the requesting user', async () => {
    (prisma.payment.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/payments/my');

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'broker_1' } })
    );
  });
});

describe('GET /api/payments (admin list)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s for a non-admin', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/payments');

    expect(res.status).toBe(403);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('allows ADMIN to list all payments, optionally scoped by brokerId', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.payment.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/payments?brokerId=broker_2');

    expect(res.status).toBe(200);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'broker_2' } })
    );
  });
});

describe('POST /api/payments (admin create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s for a non-admin trying to create a payment', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/payments')
      .send({ brokerId: 'broker_2', amount: 1000, type: 'income', description: 'x' });

    expect(res.status).toBe(403);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('creates a payment and increments the broker balance for income', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.payment.create as any).mockResolvedValue({ id: 'pay_1' });
    (prisma.user.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .post('/api/payments')
      .send({ brokerId: 'broker_2', amount: 5000, type: 'income', description: 'Комиссия' });

    expect(res.status).toBe(201);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'broker_2' },
      data: { balance: { increment: 5000 } },
    });
  });

  it('decrements the broker balance for expense', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.payment.create as any).mockResolvedValue({ id: 'pay_1' });
    (prisma.user.update as any).mockResolvedValue({});

    const app = buildApp();
    await request(app)
      .post('/api/payments')
      .send({ brokerId: 'broker_2', amount: 2000, type: 'expense', description: 'Штраф' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'broker_2' },
      data: { balance: { increment: -2000 } },
    });
  });

  it('replays the same payment without changing the balance twice', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay_1', userId: 'broker_2', amount: 5000, type: 'INCOME', description: 'Комиссия',
    });
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    const app = buildApp();
    const res = await request(app)
      .post('/api/payments')
      .set('Idempotency-Key', 'payment-123')
      .send({ brokerId: 'broker_2', amount: 5000, type: 'income', description: 'Комиссия' });

    expect(res.status).toBe(200);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key for different payment data', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay_1', userId: 'broker_2', amount: 5000, type: 'INCOME', description: 'Комиссия',
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/payments')
      .set('Idempotency-Key', 'payment-123')
      .send({ brokerId: 'broker_2', amount: 6000, type: 'income', description: 'Другая операция' });

    expect(res.status).toBe(409);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('400s when required fields are missing', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };

    const app = buildApp();
    const res = await request(app).post('/api/payments').send({ brokerId: 'broker_2' });

    expect(res.status).toBe(400);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('400s when amount is negative or not a number', async () => {
    const app = buildApp();
    const negative = await request(app).post('/api/payments').send({
      brokerId: 'broker_2', amount: -1, type: 'income', description: 'invalid',
    });
    const nonNumeric = await request(app).post('/api/payments').send({
      brokerId: 'broker_2', amount: '1000', type: 'income', description: 'invalid',
    });

    expect(negative.status).toBe(400);
    expect(nonNumeric.status).toBe(400);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
describe('GET /api/payments/broker/:brokerId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s for a non-admin', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/payments/broker/broker_2');

    expect(res.status).toBe(403);
  });

  it('allows ADMIN to view a specific broker payment history', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.payment.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/payments/broker/broker_2');

    expect(res.status).toBe(200);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'broker_2' } })
    );
  });
});
