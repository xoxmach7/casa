import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    selection: { findUnique: vi.fn(), update: vi.fn() },
    selectionApartment: { findUnique: vi.fn() },
    selectionCrmProperty: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { publicSelectionsRouter } from '../routes/public-selections.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/selections', publicSelectionsRouter);
  return app;
}

describe('GET /api/public/selections/:shareToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s for an unknown token', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/unknown-token');

    expect(res.status).toBe(404);
  });

  it('returns a client-safe projection with no broker/client PII', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      name: 'Для Ержана',
      status: 'SHARED',
      createdAt: new Date('2026-07-01'),
      apartments: [
        {
          apartmentId: 'apt_1',
          apartment: { id: 'apt_1', number: '12', floor: 3, rooms: 2, area: 61, price: 30000000, status: 'AVAILABLE', project: { id: 'proj_1', name: 'Prime Garden' } },
        },
      ],
      crmProperties: [],
    });
    (prisma.selection.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/tok_abc');

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('brokerId');
    expect(res.body).not.toHaveProperty('clientId');
    expect(res.body.apartments).toHaveLength(1);
    expect(res.body.apartments[0].project.name).toBe('Prime Garden');
  });

  it('includes secondary-market properties alongside apartments', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      name: 'Для Ержана',
      status: 'VIEWED',
      createdAt: new Date('2026-07-01'),
      apartments: [],
      crmProperties: [
        {
          crmPropertyId: 'prop_1',
          crmProperty: { id: 'prop_1', district: 'Есиль', residentialComplex: 'ЖК Дом', area: 61, price: 28000000, images: [], status: 'ACTIVE' },
        },
      ],
    });

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/tok_abc');

    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0].district).toBe('Есиль');
    expect(res.body.properties[0].area).toBe(61);
  });

  it('transitions SHARED -> VIEWED on first open', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      name: null,
      status: 'SHARED',
      createdAt: new Date(),
      apartments: [],
      crmProperties: [],
    });
    (prisma.selection.update as any).mockResolvedValue({});

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/tok_abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VIEWED');
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { shareToken: 'tok_abc' },
      data: { status: 'VIEWED', viewedAt: expect.any(Date) },
    });
  });

  it('does not regress an already-further-along status on repeat views', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      name: null,
      status: 'CLIENT_SELECTED',
      createdAt: new Date(),
      apartments: [],
      crmProperties: [],
    });

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/tok_abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CLIENT_SELECTED');
    expect(prisma.selection.update).not.toHaveBeenCalled();
  });

  it('reports which specific apartment the client selected', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({
      id: 'sel_1',
      name: null,
      status: 'CLIENT_SELECTED',
      createdAt: new Date(),
      selectedApartmentId: 'apt_1',
      apartments: [],
      crmProperties: [],
    });

    const app = buildApp();
    const res = await request(app).get('/api/public/selections/tok_abc');

    expect(res.body.selectedApartmentId).toBe('apt_1');
  });
});

describe('POST /api/public/selections/:shareToken/apartments/:apartmentId/select', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the selection token is unknown', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/unknown/apartments/apt_1/select');

    expect(res.status).toBe(404);
  });

  it('404s when the apartment is not part of the selection', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', shareToken: 'tok_abc' });
    (prisma.selectionApartment.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/tok_abc/apartments/apt_x/select');

    expect(res.status).toBe(404);
  });

  it('marks the selection CLIENT_SELECTED when the apartment belongs to it', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', shareToken: 'tok_abc' });
    (prisma.selectionApartment.findUnique as any).mockResolvedValue({ id: 'sa_1' });
    (prisma.selection.update as any).mockResolvedValue({ status: 'CLIENT_SELECTED', selectedApartmentId: 'apt_1' });

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/tok_abc/apartments/apt_1/select');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'CLIENT_SELECTED', selectedApartmentId: 'apt_1' });
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { shareToken: 'tok_abc' },
      data: { status: 'CLIENT_SELECTED', selectedApartmentId: 'apt_1', selectedCrmPropertyId: null },
    });
  });
});

describe('POST /api/public/selections/:shareToken/properties/:propertyId/select', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the selection token is unknown', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/unknown/properties/prop_1/select');

    expect(res.status).toBe(404);
  });

  it('404s when the property is not part of the selection', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', shareToken: 'tok_abc' });
    (prisma.selectionCrmProperty.findUnique as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/tok_abc/properties/prop_x/select');

    expect(res.status).toBe(404);
  });

  it('marks the selection CLIENT_SELECTED when the property belongs to it', async () => {
    (prisma.selection.findUnique as any).mockResolvedValue({ id: 'sel_1', shareToken: 'tok_abc' });
    (prisma.selectionCrmProperty.findUnique as any).mockResolvedValue({ id: 'sp_1' });
    (prisma.selection.update as any).mockResolvedValue({ status: 'CLIENT_SELECTED', selectedCrmPropertyId: 'prop_1' });

    const app = buildApp();
    const res = await request(app).post('/api/public/selections/tok_abc/properties/prop_1/select');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'CLIENT_SELECTED', selectedCrmPropertyId: 'prop_1' });
    expect(prisma.selection.update).toHaveBeenCalledWith({
      where: { shareToken: 'tok_abc' },
      data: { status: 'CLIENT_SELECTED', selectedCrmPropertyId: 'prop_1', selectedApartmentId: null },
    });
  });
});
