/**
 * Удаление ипотечного расчёта.
 *
 * Проверяется не «вызвался delete», а два узла, о которые удаление реально
 * спотыкается в схеме (обе связи стоят на Restrict):
 *   1) документ ↔ текущая ревизия ссылаются друг на друга;
 *   2) проверка поля может ссылаться на предыдущую проверку.
 * Если развязать их не в том порядке, Postgres откажет — а на экране это
 * выглядит как «не удаляется, и непонятно почему».
 *
 * Плюс доступ: чужой расчёт удалить нельзя, и запись в общий журнал должна
 * появиться ДО удаления — собственный аудит кейса уходит вместе с ним.
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

const calls: string[] = [];

const tx = vi.hoisted(() => ({
  mortgageDocument: { findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  mortgageDocumentRevision: { findMany: vi.fn(), deleteMany: vi.fn() },
  mortgageVerifiedSnapshot: { findMany: vi.fn(), deleteMany: vi.fn() },
  mortgageSnapshotDocumentSource: { deleteMany: vi.fn() },
  mortgageSnapshotReviewSource: { deleteMany: vi.fn() },
  mortgageFieldReview: { updateMany: vi.fn(), deleteMany: vi.fn() },
  mortgageCase: { delete: vi.fn() },
}));

const p = vi.hoisted(() => ({
  mortgageCase: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
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
  calls.length = 0;
  currentUser = { userId: 'broker_1', role: 'BROKER' };
  p.mortgageCase.findUnique.mockResolvedValue(theCase);
  p.auditLog.create.mockImplementation(async () => { calls.push('audit'); return {}; });
  p.$transaction.mockImplementation(async (fn: any) => fn(tx));

  tx.mortgageDocument.findMany.mockResolvedValue([{ id: 'doc_1' }]);
  tx.mortgageDocumentRevision.findMany.mockResolvedValue([{ id: 'rev_1' }, { id: 'rev_2' }]);
  tx.mortgageVerifiedSnapshot.findMany.mockResolvedValue([{ id: 'snap_1' }]);

  tx.mortgageSnapshotDocumentSource.deleteMany.mockImplementation(async () => { calls.push('snapshot_document_sources'); return { count: 1 }; });
  tx.mortgageSnapshotReviewSource.deleteMany.mockImplementation(async () => { calls.push('snapshot_review_sources'); return { count: 1 }; });
  tx.mortgageVerifiedSnapshot.deleteMany.mockImplementation(async () => { calls.push('verified_snapshots'); return { count: 1 }; });
  tx.mortgageFieldReview.updateMany.mockImplementation(async () => { calls.push('unlink_supersedes'); return { count: 2 }; });
  tx.mortgageFieldReview.deleteMany.mockImplementation(async () => { calls.push('field_reviews'); return { count: 2 }; });
  tx.mortgageDocument.updateMany.mockImplementation(async () => { calls.push('unlink_current_revision'); return { count: 1 }; });
  tx.mortgageDocumentRevision.deleteMany.mockImplementation(async () => { calls.push('revisions'); return { count: 2 }; });
  tx.mortgageDocument.deleteMany.mockImplementation(async () => { calls.push('documents'); return { count: 1 }; });
  tx.mortgageCase.delete.mockImplementation(async () => { calls.push('case'); return theCase; });
});

describe('DELETE /api/v2/cases/:caseId', () => {
  it('маршрут существует и отвечает 200', async () => {
    const res = await request(app()).delete('/api/v2/cases/case_1');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('case_1');
  });

  it('развязывает обе Restrict-связи до удаления и сносит кейс последним', async () => {
    await request(app()).delete('/api/v2/cases/case_1');

    // Ссылка документа на текущую ревизию обнуляется ДО удаления ревизий.
    expect(calls.indexOf('unlink_current_revision')).toBeLessThan(calls.indexOf('revisions'));
    // Цепочка supersedes рвётся ДО удаления проверок полей.
    expect(calls.indexOf('unlink_supersedes')).toBeLessThan(calls.indexOf('field_reviews'));
    // Ревизии — до документов, документы — до кейса.
    expect(calls.indexOf('revisions')).toBeLessThan(calls.indexOf('documents'));
    expect(calls.indexOf('documents')).toBeLessThan(calls.indexOf('case'));
    // Источники снимка — до самого снимка.
    expect(calls.indexOf('snapshot_document_sources')).toBeLessThan(calls.indexOf('verified_snapshots'));
    expect(calls.indexOf('snapshot_review_sources')).toBeLessThan(calls.indexOf('verified_snapshots'));
    expect(calls[calls.length - 1]).toBe('case');
  });

  it('всё удаление идёт одной транзакцией', async () => {
    await request(app()).delete('/api/v2/cases/case_1');
    expect(p.$transaction).toHaveBeenCalledTimes(1);
  });

  it('запись в журнал появляется ДО удаления, иначе следа не останется', async () => {
    await request(app()).delete('/api/v2/cases/case_1');
    expect(calls[0]).toBe('audit');
    expect(p.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'mortgage_case.deleted', entityId: 'case_1' }),
    }));
  });

  it('в журнал не попадают персональные данные клиента', async () => {
    await request(app()).delete('/api/v2/cases/case_1');
    const written = JSON.stringify(p.auditLog.create.mock.calls[0][0]);
    expect(written).not.toMatch(/iin|first_name|firstName|phone/i);
  });

  it('чужой расчёт не удаляется', async () => {
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, ownerId: 'someone_else' });
    const res = await request(app()).delete('/api/v2/cases/case_1');
    expect(res.status).toBe(404);
    expect(tx.mortgageCase.delete).not.toHaveBeenCalled();
  });

  it('администратор удаляет любой расчёт', async () => {
    currentUser = { userId: 'admin_1', role: 'ADMIN' };
    p.mortgageCase.findUnique.mockResolvedValue({ ...theCase, ownerId: 'someone_else' });
    const res = await request(app()).delete('/api/v2/cases/case_1');
    expect(res.status).toBe(200);
  });

  it('несуществующий расчёт — 404, а не 500', async () => {
    p.mortgageCase.findUnique.mockResolvedValue(null);
    const res = await request(app()).delete('/api/v2/cases/nope');
    expect(res.status).toBe(404);
  });

  it('кейс без документов и снимков удаляется без лишних запросов', async () => {
    tx.mortgageDocument.findMany.mockResolvedValue([]);
    tx.mortgageVerifiedSnapshot.findMany.mockResolvedValue([]);
    const res = await request(app()).delete('/api/v2/cases/case_1');
    expect(res.status).toBe(200);
    expect(tx.mortgageDocumentRevision.deleteMany).not.toHaveBeenCalled();
    expect(tx.mortgageSnapshotDocumentSource.deleteMany).not.toHaveBeenCalled();
    expect(calls).toContain('case');
  });
});
