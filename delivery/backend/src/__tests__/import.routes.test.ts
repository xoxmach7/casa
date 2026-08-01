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

vi.mock('../services/import.service', () => ({
  parseFile: vi.fn(),
  detectDataType: vi.fn(),
  validateRow: vi.fn(),
  executeImport: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    seller: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
  },
}));

import * as importService from '../services/import.service';
import { importRouter } from '../routes/import.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/import', importRouter);
  return app;
}

describe('import.routes — ADMIN-only access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
  });

  it('403s a non-admin on every endpoint', async () => {
    const app = buildApp();
    const upload = await request(app).post('/api/import/upload');
    const preview = await request(app).post('/api/import/preview').send({});
    const execute = await request(app).post('/api/import/execute').send({});

    expect(upload.status).toBe(403);
    expect(preview.status).toBe(403);
    expect(execute.status).toBe(403);
  });
});

describe('POST /api/import/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('400s when no file is attached', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/import/upload');

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file extension', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/import/upload')
      .attach('file', Buffer.from('not a spreadsheet'), { filename: 'evil.exe' });

    expect(res.status).toBe(400);
    expect(importService.parseFile).not.toHaveBeenCalled();
  });

  it('parses a valid CSV upload', async () => {
    (importService.parseFile as any).mockReturnValue({
      columns: ['Имя', 'Телефон'],
      rows: [{ Имя: 'Аружан', Телефон: '+77001234567' }],
      totalRows: 1,
    });
    (importService.detectDataType as any).mockReturnValue('contacts');

    const app = buildApp();
    const res = await request(app)
      .post('/api/import/upload')
      .attach('file', Buffer.from('Имя,Телефон\nАружан,+77001234567'), { filename: 'contacts.csv' });

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(1);
    expect(res.body.detectedType).toBe('contacts');
  });
});

describe('POST /api/import/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('400s when required params are missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/import/preview').send({ rows: [] });

    expect(res.status).toBe(400);
  });

  it('flags duplicate phones already in the database', async () => {
    const { prisma } = await import('../lib/prisma');
    (prisma.seller.findMany as any).mockResolvedValue([{ phone: '+77001234567' }]);
    (importService.validateRow as any).mockReturnValue({ valid: true, errors: [], warnings: [] });

    const app = buildApp();
    const res = await request(app).post('/api/import/preview').send({
      rows: [{ Телефон: '+77001234567' }],
      columnMapping: { Телефон: 'phone' },
      targetModel: 'seller',
    });

    expect(res.status).toBe(200);
    expect(res.body.stats.duplicates).toBe(1);
    expect(res.body.rows[0].status).toBe('duplicate');
  });
});

describe('POST /api/import/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
  });

  it('400s when required params are missing', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/import/execute').send({ rows: [] });

    expect(res.status).toBe(400);
    expect(importService.executeImport).not.toHaveBeenCalled();
  });

  it('runs the import scoped to the requesting admin as brokerId', async () => {
    (importService.executeImport as any).mockResolvedValue({ created: 1, skipped: 0, errors: 0, duration: 5, details: [] });

    const app = buildApp();
    const res = await request(app).post('/api/import/execute').send({
      rows: [{ Телефон: '+77001234567' }],
      columnMapping: { Телефон: 'phone' },
      targetModel: 'seller',
      stageMapping: {},
    });

    expect(res.status).toBe(200);
    expect(importService.executeImport).toHaveBeenCalledWith(
      expect.objectContaining({ brokerId: 'admin_1' })
    );
  });
});
