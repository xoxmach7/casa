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
    client: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    property: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { clientsRouter } from '../routes/clients.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clients', clientsRouter);
  return app;
}

describe('GET /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('scopes the list to the requesting broker for restricted roles', async () => {
    (prisma.client.findMany as any).mockResolvedValue([]);
    (prisma.client.count as any).mockResolvedValue(0);

    const app = buildApp();
    await request(app).get('/api/clients');

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brokerId: 'broker_1' } })
    );
  });

  it('does not scope by brokerId for ADMIN', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    (prisma.client.findMany as any).mockResolvedValue([]);
    (prisma.client.count as any).mockResolvedValue(0);

    const app = buildApp();
    await request(app).get('/api/clients');

    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('GET /api/clients/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when the client belongs to a different broker', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).get('/api/clients/client_1');

    expect(res.status).toBe(403);
  });

  it('404s when the client does not exist', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/clients/missing');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/clients/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when updating a client that belongs to a different broker', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2', iin: '123456789012' });

    const app = buildApp();
    const res = await request(app).put('/api/clients/client_1').send({ notes: 'hijacked' });

    expect(res.status).toBe(403);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/clients/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when deleting a client that belongs to a different broker', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).delete('/api/clients/client_1');

    expect(res.status).toBe(403);
    expect(prisma.client.delete).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/clients/:id/unlink-property', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s when the client belongs to a different broker (regression: this endpoint previously had no ownership check at all)', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app)
      .delete('/api/clients/client_1/unlink-property')
      .send({ propertyId: 'prop_1', role: 'buyer' });

    expect(res.status).toBe(403);
    expect(prisma.property.update).not.toHaveBeenCalled();
  });

  it('404s when the client does not exist', async () => {
    (prisma.client.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app)
      .delete('/api/clients/missing/unlink-property')
      .send({ propertyId: 'prop_1', role: 'buyer' });

    expect(res.status).toBe(404);
  });

  it('unlinks the property when the requesting broker owns the client', async () => {
    (prisma.client.findUnique as any).mockResolvedValue({ id: 'client_1', brokerId: 'broker_1' });
    (prisma.property.findUnique as any).mockResolvedValue({ id: 'prop_1' });
    (prisma.property.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app)
      .delete('/api/clients/client_1/unlink-property')
      .send({ propertyId: 'prop_1', role: 'buyer' });

    expect(res.status).toBe(200);
    expect(prisma.property.update).toHaveBeenCalledWith({
      where: { id: 'prop_1' },
      data: { buyerId: null },
    });
  });
});
