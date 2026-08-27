/**
 * DEC-API-002 — GET /api/v2/cases, вспомогательный листинг кейсов.
 *
 * Не входит в 45 канонических контрактов. Тесты проверяют требования владельца:
 * только доступные актору кейсы, изоляция области доступа без утечки самого
 * факта существования чужих кейсов, пагинация, детерминированный порядок,
 * минимальный allowlist полей, read-only.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = currentUser; next(); },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  mortgageCaseParty: { create: vi.fn() },
  mortgageIdempotencyRecord: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
}));

vi.mock('../lib/prisma', () => ({
  prisma: { ...p, $transaction: vi.fn(async (cb: any) => cb(p)) },
}));

import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/cases', mortgageCasesRouter);
  return i;
}

function row(id: string, offsetMinutes = 0) {
  return {
    id,
    status: 'DRAFT',
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date(Date.UTC(2026, 7, 20, 0, offsetMinutes, 0)),
  };
}

describe('GET /api/v2/cases (DEC-API-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { userId: 'broker_1', role: 'BROKER' };
    p.mortgageCase.findMany.mockResolvedValue([]);
  });

  it('брокер видит только свои кейсы — фильтр по владельцу в запросе к БД', async () => {
    await request(app()).get('/api/v2/cases');
    const args = p.mortgageCase.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ ownerId: 'broker_1' });
  });

  it('администратор не ограничен владельцем', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    await request(app()).get('/api/v2/cases');
    const args = p.mortgageCase.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  it('порядок детерминирован: updatedAt + id как tie-breaker', async () => {
    await request(app()).get('/api/v2/cases');
    const args = p.mortgageCase.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('отдаёт минимальный allowlist полей: без client_id и owner_id', async () => {
    p.mortgageCase.findMany.mockResolvedValue([row('case_1')]);
    const res = await request(app()).get('/api/v2/cases');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data[0]).sort())
      .toEqual(['created_at', 'id', 'status', 'updated_at', 'version']);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('client_id');
    expect(body).not.toContain('owner_id');
    expect(body).not.toContain('broker_1');
  });

  it('в БД запрашиваются только разрешённые поля (select-allowlist)', async () => {
    await request(app()).get('/api/v2/cases');
    const args = p.mortgageCase.findMany.mock.calls[0][0];
    expect(args.select).toEqual({
      id: true, status: true, version: true, createdAt: true, updatedAt: true,
    });
  });

  it('пагинация: запрашивается limit+1, лишняя строка не отдаётся', async () => {
    p.mortgageCase.findMany.mockResolvedValue([row('c1', 3), row('c2', 2), row('c3', 1)]);
    const res = await request(app()).get('/api/v2/cases?limit=2');
    expect(res.status).toBe(200);
    expect(p.mortgageCase.findMany.mock.calls[0][0].take).toBe(3);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page_info).toEqual({ has_more: true, next_cursor: 'c2', limit: 2 });
  });

  it('последняя страница: has_more=false, курсор null', async () => {
    p.mortgageCase.findMany.mockResolvedValue([row('c1')]);
    const res = await request(app()).get('/api/v2/cases?limit=2');
    expect(res.body.page_info).toEqual({ has_more: false, next_cursor: null, limit: 2 });
  });

  it('курсор пропускает саму опорную строку (skip: 1)', async () => {
    await request(app()).get('/api/v2/cases?cursor=c2');
    const args = p.mortgageCase.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: 'c2' });
    expect(args.skip).toBe(1);
  });

  it('пустой список — это 200 с пустым массивом, а не 404', async () => {
    const res = await request(app()).get('/api/v2/cases');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.page_info.has_more).toBe(false);
  });

  it('некорректный limit отвергается, а не молча обрезается', async () => {
    const res = await request(app()).get('/api/v2/cases?limit=5000');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(p.mortgageCase.findMany).not.toHaveBeenCalled();
  });

  it('неизвестный параметр запроса отвергается', async () => {
    const res = await request(app()).get('/api/v2/cases?owner_id=broker_2');
    expect(res.status).toBe(400);
    expect(p.mortgageCase.findMany).not.toHaveBeenCalled();
  });
});
