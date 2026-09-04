/**
 * Убрать ипотечный расчёт из работы.
 *
 * ПОЧЕМУ АРХИВ, А НЕ УДАЛЕНИЕ. Сначала здесь был честный DELETE, разбиравший
 * цепочку документов в правильном порядке, и девять зелёных тестов на моках.
 * На проде он отвечал 500 на каждом кейсе: в базе стоят триггеры append-only
 * (mortgage_audit_events, mortgage_document_revisions, mortgage_field_reviews,
 * mortgage_verified_snapshots и таблицы источников снимка). Удаление кейса
 * тянет за собой SET NULL по аудиту — и триггер поднимает
 * «mortgage_audit_events is append-only». История расчёта неудаляема намеренно,
 * это регуляторное требование, а не недоработка.
 *
 * Моки Prisma триггеров не видят, поэтому тест ниже проверяет то, что от них
 * не зависит: маршрут идёт разрешёнными переходами машины состояний и убранный
 * расчёт исчезает из рабочего списка. Возвращать сюда DELETE нельзя.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser: { userId: string; role: string } | null = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!currentUser) { res.status(401).json({ error: 'unauthorized' }); return; }
    req.user = currentUser;
    next();
  },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  mortgageAuditEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ prisma: p }));

import { mortgageCasesRouter } from '../routes/mortgage-cases.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2/cases', mortgageCasesRouter);
  return i;
}

const theCase = { id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'broker_1', role: 'BROKER' };
  p.mortgageCase.findUnique.mockResolvedValue(theCase);
  p.mortgageCase.update.mockImplementation(async ({ where, data }: any) =>
    ({ ...theCase, id: where.id, status: data.status, version: theCase.version + 1 }));
  p.mortgageAuditEvent.create.mockResolvedValue({});
  p.auditLog.create.mockResolvedValue({});
  p.mortgageCase.findMany.mockResolvedValue([]);
});

describe('POST /api/v2/cases/:caseId/archive', () => {
  it('черновик уходит в архив разрешённым путём: сначала отмена, потом архив', async () => {
    const res = await request(app()).post('/api/v2/cases/case_1/archive');
    expect(res.status).toBe(200);

    const statuses = p.mortgageCase.update.mock.calls.map((c: any) => c[0].data.status);
    expect(statuses).toEqual(['CANCELLED', 'ARCHIVED']);
  });

  it('уже отменённый расчёт архивируется одним переходом', async () => {
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, status: 'CANCELLED' });
    await request(app()).post('/api/v2/cases/case_1/archive');
    expect(p.mortgageCase.update.mock.calls.map((c: any) => c[0].data.status)).toEqual(['ARCHIVED']);
  });

  it('повторный вызов на архивном расчёте ничего не меняет', async () => {
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, status: 'ARCHIVED' });
    const res = await request(app()).post('/api/v2/cases/case_1/archive');
    expect(res.status).toBe(200);
    expect(p.mortgageCase.update).not.toHaveBeenCalled();
  });

  it('каждый переход попадает в аудит кейса, а сам факт — в общий журнал', async () => {
    await request(app()).post('/api/v2/cases/case_1/archive');
    expect(p.mortgageAuditEvent.create).toHaveBeenCalledTimes(2);
    expect(p.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'mortgage_case.archived', entityId: 'case_1' }),
    }));
  });

  it('в журнал не попадают персональные данные клиента', async () => {
    await request(app()).post('/api/v2/cases/case_1/archive');
    const written = JSON.stringify(p.auditLog.create.mock.calls[0][0]);
    expect(written).not.toMatch(/iin|first_name|firstName|phone/i);
  });

  it('чужой расчёт не архивируется', async () => {
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, ownerId: 'someone_else' });
    const res = await request(app()).post('/api/v2/cases/case_1/archive');
    expect(res.status).toBe(404);
    expect(p.mortgageCase.update).not.toHaveBeenCalled();
  });

  it('администратор убирает любой расчёт', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, ownerId: 'someone_else' });
    const res = await request(app()).post('/api/v2/cases/case_1/archive');
    expect(res.status).toBe(200);
  });

  it('несуществующий расчёт — 404', async () => {
    p.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app()).post('/api/v2/cases/nope/archive');
    expect(res.status).toBe(404);
  });

  it('физического удаления кейса не осталось нигде', async () => {
    const res = await request(app()).delete('/api/v2/cases/case_1');
    // Маршрута нет — express отдаёт 404 сам, до всякой логики.
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v2/cases — рабочий список', () => {
  it('не показывает архив и отменённые', async () => {
    await request(app()).get('/api/v2/cases');
    const where = p.mortgageCase.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ['ARCHIVED', 'CANCELLED'] });
  });

  it('брокеру по-прежнему видны только свои', async () => {
    await request(app()).get('/api/v2/cases');
    expect(p.mortgageCase.findMany.mock.calls[0][0].where.ownerId).toBe('broker_1');
  });
});
