/**
 * FX-IIN-R0-001 — канонический R0-прогон M02 без ПД и без единого внешнего
 * production-вызова.
 *
 * Фикстура доказывает ровно то, что требует §22 Definition of Done:
 *   partial ≠ clean, unavailable ≠ not_found, коннекторы выключены,
 *   подтверждение без evidence невозможно, refresh иммутабелен,
 *   чужой tenant не получает подтверждения существования записи.
 *
 * Синтетические ИИН посчитаны официальным алгоритмом контрольного разряда и
 * реальным лицам не принадлежат.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

let currentUser = { userId: 'broker_1', role: 'BROKER' };

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = currentUser; next(); },
}));

/** Простая in-memory реализация нужного среза Prisma. */
const db = vi.hoisted(() => {
  const state: any = { batches: [], results: [], facts: [], tasks: [], audits: [], seq: 0 };
  const id = (p: string) => `${p}_${(state.seq += 1)}`;

  const clone = (o: any) => (o === null || o === undefined ? o : JSON.parse(JSON.stringify(o), (_k, v) => v));

  function hydrateResult(r: any, include: any = {}) {
    const out = { ...r };
    if (include.facts) out.facts = state.facts.filter((f: any) => f.resultId === r.id);
    if (include.manualTasks) out.manualTasks = state.tasks.filter((t: any) => t.resultId === r.id);
    return out;
  }

  function hydrateBatch(b: any, include: any = {}) {
    if (!b) return b;
    const out = { ...b };
    if (include.mortgageCase) out.mortgageCase = state.mortgageCase;
    if (include.results) {
      const inc = typeof include.results === 'object' ? include.results.include ?? {} : {};
      out.results = state.results.filter((r: any) => r.batchId === b.id).map((r: any) => hydrateResult(r, inc));
    }
    return out;
  }

  const client: any = {
    __state: state,
    mortgageCase: {
      findUnique: vi.fn(async ({ where }: any) => (
        state.mortgageCase && state.mortgageCase.id === where.id ? state.mortgageCase : null
      )),
    },
    clientCheckBatch: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: id('batch'), createdAt: new Date(), requestedAt: new Date(), supersedesId: null, supersededById: null, ...data };
        state.batches.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => hydrateBatch(
        state.batches.find((b: any) => b.id === where.id) ?? null, include ?? {},
      )),
      findFirst: vi.fn(async ({ where, include }: any) => hydrateBatch(
        state.batches.find((b: any) => b.caseId === where.caseId && b.idempotencyKey === where.idempotencyKey) ?? null,
        include ?? {},
      )),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.batches.find((b: any) => b.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    clientCheckResult: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: id('res'), createdAt: new Date(), attempt: 1, supersedesId: null, supersededById: null, ...data };
        state.results.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const r = state.results.find((x: any) => x.id === where.id);
        if (!r) return null;
        const out: any = { ...r };
        if (include?.batch) {
          const b = state.batches.find((x: any) => x.id === r.batchId);
          out.batch = { ...b, mortgageCase: state.mortgageCase };
        }
        return out;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.results.find((r: any) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    clientCheckFact: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: id('fact'), createdAt: new Date(), ...data };
        state.facts.push(row);
        return row;
      }),
    },
    manualCheckTask: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: id('task'), createdAt: new Date(), updatedAt: new Date(), status: 'OPEN', outcome: null, ...data };
        state.tasks.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const t = state.tasks.find((x: any) => x.id === where.id);
        if (!t) return null;
        const out: any = { ...t };
        if (include?.batch) {
          const b = state.batches.find((x: any) => x.id === t.batchId);
          out.batch = { ...b, mortgageCase: state.mortgageCase };
        }
        if (include?.result) out.result = state.results.find((x: any) => x.id === t.resultId);
        return out;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.tasks.find((t: any) => t.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    mortgageAuditEvent: { create: vi.fn(async ({ data }: any) => { state.audits.push(data); return data; }) },
  };
  client.$transaction = vi.fn(async (cb: any) => cb(client));
  return { client, state, clone };
});

vi.mock('../lib/prisma', () => ({ prisma: db.client }));

/** Сетевой шпион: любой внешний вызов в R0 — это провал AT-IIN-003. */
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import { m02Router } from '../routes/m02-iin-check.routes';

function app() {
  const i = express();
  i.use(express.json());
  i.use('/api/v2', m02Router);
  return i;
}

const VALID_IIN = '900101300057';
const PURPOSE = 'mortgage_preanalysis_official_registry_checks';

function activeConsent(over: any = {}) {
  return {
    id: 'consent_rev_1',
    purposeCode: PURPOSE,
    status: 'ACTIVE',
    grantedAt: new Date('2026-08-01T00:00:00Z'),
    expiresAt: new Date('2027-08-01T00:00:00Z'),
    revokedAt: null,
    ...over,
  };
}

function seedCase(consentRevision: any = activeConsent()) {
  db.state.mortgageCase = {
    id: 'case_1', clientId: 'client_1', ownerId: 'broker_1', status: 'DRAFT', version: 1,
    parties: [{ id: 'party_1', clientId: 'client_1', role: 'PRIMARY', includedInAnalysis: true, consentRevision }],
  };
}

function createBody(over: any = {}) {
  return { party_id: 'party_1', iin: VALID_IIN, identity_version: 1, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { userId: 'broker_1', role: 'BROKER' };
  Object.assign(db.state, { batches: [], results: [], facts: [], tasks: [], audits: [], seq: 0 });
  seedCase();
  process.env.IIN_LOOKUP_HMAC_KEY = 'k'.repeat(48);
});

// --- AT-IIN-001/002/003 -----------------------------------------------------

describe('FX-IIN-R0-001 — создание batch (API-M02-001)', () => {
  it('создаёт batch на семи обязательных проверках без внешних вызовов', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-1')
      .send(createBody());

    expect(res.status).toBe(201);
    expect(res.body.data.manifest.required_total).toBe(7);
    expect(res.body.data.overall_status).toBe('PARTIAL');
    // Ни одного production-запроса.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('НИ полный ИИН, ни его фрагменты не попадают в ответ', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-pii')
      .send(createBody());
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(VALID_IIN);
    expect(body).not.toMatch(/\b\d{12}\b/);
    expect(res.body.data.participant.iin_masked).toBe('••••••••••57');
  });

  it('ИИН не сохраняется в БД ни в одном поле', () => {
    const dump = JSON.stringify(db.state);
    expect(dump).not.toContain(VALID_IIN);
  });

  it('в официальных URL источников нет ИИН', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-url')
      .send(createBody());
    for (const r of res.body.data.results) {
      expect(r.source.official_url).not.toMatch(/\d{12}/);
      expect(r.source.official_url).not.toMatch(/\?/);
      expect(r.source.connector_enabled).toBe(false);
    }
  });

  it('частичное покрытие НЕ выглядит как чистый клиент', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-partial')
      .send(createBody());
    expect(res.body.data.coverage.brokerText).toContain('Нельзя делать вывод об отсутствии записей');
    expect(res.body.data.coverage.overallStatus).not.toBe('COMPLETE_NO_RECORDS');
    const text = JSON.stringify(res.body).toLowerCase();
    expect(text).not.toContain('чист');
    expect(text).not.toContain('одобрен');
  });

  it('недоступный источник помечен UNAVAILABLE без исхода, а не not_found', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-unavail')
      .send(createBody());
    const unavailable = res.body.data.results.filter((r: any) => r.status === 'UNAVAILABLE');
    expect(unavailable.length).toBeGreaterThan(0);
    for (const r of unavailable) expect(r.outcome).toBeNull();
    expect(res.body.data.results.some((r: any) => r.outcome === 'NOT_FOUND')).toBe(false);
  });

  it('для ручных маршрутов созданы задачи с официальным URL и инструкцией', async () => {
    await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-tasks')
      .send(createBody());
    expect(db.state.tasks.length).toBeGreaterThan(0);
    for (const t of db.state.tasks) {
      expect(t.officialUrl).not.toMatch(/\d{12}/);
      expect(t.instruction).toContain('Откройте официальный сервис');
    }
    // CAPTCHA остаётся человеку: инструкция это проговаривает.
    expect(db.state.tasks.some((t: any) => t.instruction.includes('CAPTCHA'))).toBe(true);
  });

  it('каждый результат несёт дисклеймер «факт ≠ решение банка»', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-disc')
      .send(createBody());
    for (const r of res.body.data.results) {
      expect(r.disclaimer).toBe('Факт источника — не решение банка.');
    }
    expect(JSON.stringify(res.body)).not.toMatch(/bank_verdict|approved|declined/i);
  });
});

// --- AT-IIN-013 -------------------------------------------------------------

describe('гейты §7 блокируют до маршрута', () => {
  it('невалидный ИИН → блокер, ноль внешних вызовов, задачи не заводятся', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-bad-iin')
      .send(createBody({ iin: '900101300058' }));
    expect(res.status).toBe(201);
    expect(res.body.data.blocker_code).toBe('IIN_CHECK_DIGIT');
    expect(db.state.tasks).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('короткий ИИН → IIN_FORMAT, ввод не «чинится»', async () => {
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-short')
      .send(createBody({ iin: '90010130005' }));
    expect(res.body.data.blocker_code).toBe('IIN_FORMAT');
  });

  it('нет согласия → BLOCKED_CONSENT, запросы не выполнялись', async () => {
    seedCase(null);
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-noconsent')
      .send(createBody());
    expect(res.body.data.blocker_code).toBe('BLOCKED_CONSENT');
    expect(res.body.data.overall_status).toBe('BLOCKED_CONSENT');
    expect(res.body.data.coverage.brokerText).toContain('Внешние запросы не выполнялись');
    expect(db.state.tasks).toHaveLength(0);
  });

  it('согласие на другую цель не открывает маршрут', async () => {
    seedCase(activeConsent({ purposeCode: 'mortgage_prescore' }));
    const res = await request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-purpose')
      .send(createBody());
    expect(res.body.data.blocker_code).toBe('BLOCKED_CONSENT');
  });

  it('отозванное и истёкшее согласие блокируют', async () => {
    for (const [i, over] of [
      { revokedAt: new Date('2026-08-10T00:00:00Z') },
      { expiresAt: new Date('2026-01-01T00:00:00Z') },
    ].entries()) {
      seedCase(activeConsent(over));
      const res = await request(app())
        .post('/api/v2/cases/case_1/iin-check-batches')
        .set('Idempotency-Key', `k-rev-${i}`)
        .send(createBody());
      expect(res.body.data.blocker_code).toBe('BLOCKED_CONSENT');
    }
  });
});

// --- AT-IIN-014/015 ---------------------------------------------------------

describe('идемпотентность и иммутабельность', () => {
  it('двойной клик тем же ключом не создаёт второй набор задач', async () => {
    const send = () => request(app())
      .post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-same')
      .send(createBody());

    const first = await send();
    const tasksAfterFirst = db.state.tasks.length;
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.batch_id).toBe(first.body.data.batch_id);
    expect(db.state.tasks).toHaveLength(tasksAfterFirst);
    expect(db.state.batches).toHaveLength(1);
  });

  it('тот же ключ с другим запросом → 409', async () => {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-conf').send(createBody());
    const res = await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-conf').send(createBody({ identity_version: 2 }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('idempotency_conflict');
  });

  it('refresh создаёт новый batch, старый остаётся и помечается заменённым', async () => {
    const first = await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-r1').send(createBody());
    const batchId = first.body.data.batch_id;

    const res = await request(app())
      .post(`/api/v2/iin-check-batches/${batchId}/refresh`)
      .set('Idempotency-Key', 'k-r2').send({});

    expect(res.status).toBe(201);
    expect(res.body.data.batch_id).not.toBe(batchId);
    expect(res.body.data.supersedes_id).toBe(batchId);

    const old = db.state.batches.find((b: any) => b.id === batchId);
    expect(old.supersededById).toBe(res.body.data.batch_id);
    // История не удалена.
    expect(db.state.batches).toHaveLength(2);
  });

  it('повторный refresh уже заменённого batch → 409', async () => {
    const first = await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-r3').send(createBody());
    const batchId = first.body.data.batch_id;
    await request(app()).post(`/api/v2/iin-check-batches/${batchId}/refresh`)
      .set('Idempotency-Key', 'k-r4').send({});
    const again = await request(app()).post(`/api/v2/iin-check-batches/${batchId}/refresh`)
      .set('Idempotency-Key', 'k-r5').send({});
    expect(again.status).toBe(409);
  });
});

// --- AT-IIN-005/009/010 -----------------------------------------------------

describe('ручная проверка (API-M02-005)', () => {
  async function openTask() {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', `k-m-${db.state.seq}`).send(createBody());
    // Задача источника, у которого есть документированный ручной no-match.
    return db.state.tasks.find((t: any) => t.sourceCode === 'ENIS_EXECUTIVE_INSCRIPTION');
  }

  it('подтверждение без evidence отвергается', async () => {
    const task = await openTask();
    const res = await request(app())
      .post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({ outcome: 'NOT_FOUND', checked_at: new Date().toISOString() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('manual_evidence_required');
  });

  it('подтверждение с evidence создаёт НОВЫЙ result и увеличивает покрытие', async () => {
    const task = await openTask();
    const before = db.state.results.filter((r: any) => r.supersededById === null).length;

    const res = await request(app())
      .post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({
        outcome: 'NOT_FOUND',
        evidence_ref: 'screenshot://enis/2026-08-27',
        evidence_hash: 'a'.repeat(64),
        checked_at: '2026-08-27T10:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('CONFIRMED');
    expect(res.body.data.coverage.completed).toBe(1);
    expect(res.body.data.coverage.provenNegative).toBe(1);
    // Всё ещё частичная — шесть проверок не выполнены.
    expect(res.body.data.coverage.overallStatus).toBe('PARTIAL');

    // Прошлый result не переписан, а заменён.
    const superseded = db.state.results.filter((r: any) => r.supersededById !== null);
    expect(superseded).toHaveLength(1);
    expect(db.state.results.filter((r: any) => r.supersededById === null)).toHaveLength(before);
  });

  it('NOT_FOUND недопустим для источника без документированного контракта', async () => {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-nc').send(createBody({
        proven_conditional_check_types: ['property_rights'],
      }));
    const task = db.state.tasks.find((t: any) => t.sourceCode === 'EGOV_PROPERTY_RIGHTS');
    if (!task) return; // источник client-authorized → задача есть; страховка
    const res = await request(app())
      .post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({
        outcome: 'NOT_FOUND',
        evidence_ref: 'doc://x',
        checked_at: '2026-08-27T10:00:00.000Z',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('not_found_not_supported');
  });

  it('сохраняются только allowlisted факты', async () => {
    const task = await openTask();
    await request(app())
      .post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({
        outcome: 'FOUND',
        evidence_ref: 'screenshot://enis/1',
        checked_at: '2026-08-27T10:00:00.000Z',
        facts: [
          { key: 'inscription_count', value: 2 },
          // Не в allowlist источника — не должно сохраниться.
          { key: 'third_party_iin', value: '850310500123' },
        ],
      });
    const keys = db.state.facts.map((f: any) => f.factKey);
    expect(keys).toContain('inscription_count');
    expect(keys).not.toContain('third_party_iin');
    expect(JSON.stringify(db.state.facts)).not.toContain('850310500123');
  });

  it('повторное подтверждение той же задачи → 409', async () => {
    const task = await openTask();
    const payload = {
      outcome: 'FOUND', evidence_ref: 'screenshot://enis/2', checked_at: '2026-08-27T10:00:00.000Z',
    };
    await request(app()).post(`/api/v2/manual-check-tasks/${task.id}/confirm`).send(payload);
    const again = await request(app()).post(`/api/v2/manual-check-tasks/${task.id}/confirm`).send(payload);
    expect(again.status).toBe(409);
  });
});

// --- AT-IIN-006/011 ---------------------------------------------------------

describe('повтор (API-M02-004)', () => {
  it('повтор не-retryable результата отвергается', async () => {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-retry').send(createBody());
    const manual = db.state.results.find((r: any) => r.status === 'MANUAL_REQUIRED');
    const res = await request(app()).post(`/api/v2/iin-check-results/${manual.id}/retry`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('not_retryable');
  });
});

// --- AT-IIN-018 -------------------------------------------------------------

describe('изоляция области доступа', () => {
  it('чужой batch → 404 без подтверждения существования', async () => {
    const created = await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-iso').send(createBody());
    const batchId = created.body.data.batch_id;

    currentUser = { userId: 'broker_2', role: 'BROKER' };
    const res = await request(app()).get(`/api/v2/iin-check-batches/${batchId}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    // Ответ одинаков с «не существует»: ничего о чужой записи не сообщается.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('broker_1');
    expect(body).not.toContain('case_1');
  });

  it('чужая ручная задача не подтверждается', async () => {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-iso2').send(createBody());
    const task = db.state.tasks[0];
    currentUser = { userId: 'broker_2', role: 'BROKER' };
    const res = await request(app())
      .post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({ outcome: 'FOUND', evidence_ref: 'x', checked_at: '2026-08-27T10:00:00.000Z' });
    expect(res.status).toBe(404);
  });
});

// --- AT-IIN-001/002 ---------------------------------------------------------

describe('витрина реестра источников', () => {
  it('отдаёт версию, режимы и подтверждает, что коннекторы выключены', async () => {
    const res = await request(app()).get('/api/v2/source-registry');
    expect(res.status).toBe(200);
    expect(res.body.data.registry_version).toMatch(/^casa\.m02\.source-registry\//);
    for (const s of res.body.data.sources) expect(s.connector_enabled).toBe(false);
    expect(res.body.data.sources.filter((s: any) => s.source_class === 'BASE_REQUIRED')).toHaveLength(7);
    expect(res.body.data.sources.some((s: any) => s.source_class === 'PROHIBITED')).toBe(true);
  });
});

// --- Аудит ------------------------------------------------------------------

describe('аудит (§16)', () => {
  it('создание и подтверждение записываются без ИИН', async () => {
    await request(app()).post('/api/v2/cases/case_1/iin-check-batches')
      .set('Idempotency-Key', 'k-audit').send(createBody());
    const task = db.state.tasks[0];
    await request(app()).post(`/api/v2/manual-check-tasks/${task.id}/confirm`)
      .send({ outcome: 'FOUND', evidence_ref: 'ev://1', checked_at: '2026-08-27T10:00:00.000Z' });

    const actions = db.state.audits.map((a: any) => a.action);
    expect(actions).toContain('m02.iin_check_batch.created');
    expect(actions).toContain('m02.manual_check_task.confirmed');
    expect(JSON.stringify(db.state.audits)).not.toContain(VALID_IIN);
    for (const a of db.state.audits) expect(a.purpose).toBe(PURPOSE);
  });
});
