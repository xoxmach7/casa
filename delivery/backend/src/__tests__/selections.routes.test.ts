import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'broker_1', role: 'BROKER' };
    next();
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    selection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    selectionApartment: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { selectionsRouter } from '../routes/selections.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/selections', selectionsRouter);
  return app;
}

describe('GET /api/selections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the list to the requesting broker for restricted roles', async () => {
    (prisma.selection.findMany as any).mockResolvedValue([]);

    const app = buildApp();
    await request(app).get('/api/selections');

    expect(prisma.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brokerId: 'broker_1' } })
    );
  });
});

describe('POST /api/selections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a selection owned by the requesting broker', async () => {
    (prisma.selection.create as any).mockResolvedValue({ id: 'sel_1' });

    const app = buildApp();
    const res = await request(app).post('/api/selections').send({ clientId: 'client_1', name: 'Для Ержана' });

    expect(res.status).toBe(201);
    expect(prisma.selection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: 'client_1', name: 'Для Ержана', brokerId: 'broker_1' }),
      })
    );
  });

  it('400s when clientId is missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/selections').send({});
    expect(res.status).toBe(400);
    expect(prisma.selection.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/selections/:id/apartments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403s when the selection belongs to a different broker', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/selections/sel_1/apartments')
      .send({ apartmentId: 'apt_1' });

    expect(res.status).toBe(403);
    expect(prisma.selectionApartment.upsert).not.toHaveBeenCalled();
  });

  it('adds an apartment idempotently via upsert', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', brokerId: 'broker_1' });
    (prisma.selectionApartment.upsert as any).mockResolvedValue({ id: 'sa_1' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/selections/sel_1/apartments')
      .send({ apartmentId: 'apt_1' });

    expect(res.status).toBe(201);
    expect(prisma.selectionApartment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { selectionId_apartmentId: { selectionId: 'sel_1', apartmentId: 'apt_1' } },
      })
    );
  });
});

describe('DELETE /api/selections/:id/apartments/:apartmentId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the apartment when the selection belongs to the requesting broker', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', brokerId: 'broker_1' });
    (prisma.selectionApartment.deleteMany as any).mockResolvedValue({ count: 1 });

    const app = buildApp();
    const res = await request(app).delete('/api/selections/sel_1/apartments/apt_1');

    expect(res.status).toBe(200);
    expect(prisma.selectionApartment.deleteMany).toHaveBeenCalledWith({
      where: { selectionId: 'sel_1', apartmentId: 'apt_1' },
    });
  });
});

describe('PATCH /api/selections/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates name/status when the selection belongs to the requesting broker', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', brokerId: 'broker_1' });
    (prisma.selection.update as any).mockResolvedValue({ id: 'sel_1', status: 'CLOSED' });

    const app = buildApp();
    const res = await request(app).patch('/api/selections/sel_1').send({ status: 'CLOSED' });

    expect(res.status).toBe(200);
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { id: 'sel_1' },
      data: { status: 'CLOSED' },
    });
  });

  it('403s when the selection belongs to a different broker', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', brokerId: 'broker_2' });

    const app = buildApp();
    const res = await request(app).patch('/api/selections/sel_1').send({ status: 'CLOSED' });

    expect(res.status).toBe(403);
    expect(prisma.selection.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/selections/:id/share', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions a DRAFT selection to SHARED and returns the token', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      brokerId: 'broker_1',
      status: 'DRAFT',
      shareToken: 'tok_abc',
    });
    (prisma.selection.update as any).mockResolvedValue({ shareToken: 'tok_abc', status: 'SHARED' });

    const app = buildApp();
    const res = await request(app).post('/api/selections/sel_1/share');

    expect(res.status).toBe(200);
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { id: 'sel_1' },
      data: { status: 'SHARED' },
    });
    expect(res.body).toEqual({ shareToken: 'tok_abc', status: 'SHARED' });
  });

  it('does not regress an already-shared selection, just returns its token', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      brokerId: 'broker_1',
      status: 'VIEWED',
      shareToken: 'tok_abc',
    });
    (prisma.selection.update as any).mockResolvedValue({ shareToken: 'tok_abc', status: 'VIEWED' });

    const app = buildApp();
    const res = await request(app).post('/api/selections/sel_1/share');

    expect(res.status).toBe(200);
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { id: 'sel_1' },
      data: {},
    });
  });
});
