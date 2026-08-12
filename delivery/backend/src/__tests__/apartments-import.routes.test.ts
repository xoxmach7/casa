import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import ExcelJS from 'exceljs';

let currentUser: any = { userId: 'dev_1', role: 'DEVELOPER' };

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

vi.mock('../lib/access', () => ({
  blockCrmWrites: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    apartment: { upsert: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { apartmentsRouter } from '../routes/apartments.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/apartments', apartmentsRouter);
  return app;
}

async function makeXlsx(rows: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Квартиры');
  sheet.columns = ['Этаж', 'Номер', 'Комнат', 'Площадь', 'Цена', 'Корпус'].map((h) => ({ header: h, key: h }));
  rows.forEach((r) => sheet.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('POST /api/apartments/import-xlsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
    (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', developerId: 'dev_1' });
    (prisma.apartment.upsert as any).mockResolvedValue({});
  });

  it('parses the .xlsx and upserts each row', async () => {
    const buf = await makeXlsx([
      { 'Этаж': 5, 'Номер': '52', 'Комнат': 2, 'Площадь': 61.5, 'Цена': 32000000, 'Корпус': 'Литер 1' },
      { 'Этаж': 6, 'Номер': '61', 'Комнат': 1, 'Площадь': 40, 'Цена': 21000000, 'Корпус': 'Литер 1' },
    ]);
    const res = await request(buildApp())
      .post('/api/apartments/import-xlsx')
      .field('projectId', 'p1')
      .attach('file', buf, 'fund.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(prisma.apartment.upsert).toHaveBeenCalledTimes(2);
  });

  it('skips rows with invalid data but imports the valid ones', async () => {
    const buf = await makeXlsx([
      { 'Этаж': 5, 'Номер': '52', 'Комнат': 2, 'Площадь': 61.5, 'Цена': 32000000 },
      { 'Этаж': '', 'Номер': '', 'Комнат': '', 'Площадь': '', 'Цена': '' }, // мусор
    ]);
    const res = await request(buildApp())
      .post('/api/apartments/import-xlsx')
      .field('projectId', 'p1')
      .attach('file', buf, 'fund.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(prisma.apartment.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects a project that does not belong to the developer (403)', async () => {
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const buf = await makeXlsx([{ 'Этаж': 5, 'Номер': '52', 'Комнат': 2, 'Площадь': 61.5, 'Цена': 32000000 }]);
    const res = await request(buildApp())
      .post('/api/apartments/import-xlsx')
      .field('projectId', 'foreign')
      .attach('file', buf, 'fund.xlsx');

    expect(res.status).toBe(403);
    expect(prisma.apartment.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(buildApp())
      .post('/api/apartments/import-xlsx')
      .field('projectId', 'p1');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/apartments/import-template', () => {
  beforeEach(() => {
    currentUser = { userId: 'dev_1', role: 'DEVELOPER' };
  });

  it('serves an .xlsx template (not swallowed by GET /:id)', async () => {
    const res = await request(buildApp()).get('/api/apartments/import-template');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheet');
  });
});
