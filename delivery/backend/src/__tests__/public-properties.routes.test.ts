import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    crmProperty: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';
import { publicPropertiesRouter } from '../routes/public-properties.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/properties', publicPropertiesRouter);
  return app;
}

const SAMPLE = {
  id: 'prop_1',
  district: 'Бостандыкский',
  residentialComplex: 'Comfort City',
  address: 'ул. Розыбакиева 100',
  lat: 43.2,
  lng: 76.89,
  rooms: 2,
  area: '60.00',
  price: '36000000.00',
  images: ['https://example.com/1.jpg'],
  floor: 5,
  totalFloors: 9,
  buildingType: 'MONOLITH',
  repairState: 'EURO',
  balconyType: 'LOGGIA',
};

describe('GET /api/public/properties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists published Almaty properties as cards', async () => {
    (prisma.crmProperty.findMany as any).mockResolvedValue([SAMPLE]);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties');

    expect(res.status).toBe(200);
    expect(res.body.properties).toHaveLength(1);
    expect(res.body.properties[0]).toMatchObject({
      id: 'prop_1',
      district: 'Бостандыкский',
      residentialComplex: 'Comfort City',
    });
    expect(prisma.crmProperty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          funnelStage: 'LEADS',
        }),
      })
    );
  });
});

describe('GET /api/public/properties/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full detail for a published property', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(SAMPLE);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties/prop_1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'prop_1', floor: 5, totalFloors: 9 });
  });

  it('404s when the property does not exist or is not published', async () => {
    (prisma.crmProperty.findFirst as any).mockResolvedValue(null);

    const app = buildApp();
    const res = await request(app).get('/api/public/properties/missing');

    expect(res.status).toBe(404);
  });
});
