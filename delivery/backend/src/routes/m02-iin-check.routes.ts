/**
 * M02 R0 — канонические эндпоинты API-M02-001…006.
 *
 * Пути — из 06_API_CONTRACTS.csv (canonical_path), корень кейса разрешён
 * DEC-API-001 в пользу /api/v2/cases.
 *
 *   API-M02-001  POST /api/v2/cases/{case_id}/iin-check-batches
 *   API-M02-002  GET  /api/v2/iin-check-batches/{batch_id}
 *   API-M02-003  GET  /api/v2/iin-check-batches/{batch_id}/results
 *   API-M02-004  POST /api/v2/iin-check-results/{result_id}/retry
 *   API-M02-005  POST /api/v2/manual-check-tasks/{task_id}/confirm
 *   API-M02-006  POST /api/v2/iin-check-batches/{batch_id}/refresh
 *
 * Инварианты, за которые отвечает этот файл:
 *  - полный ИИН НИКОГДА не попадает в путь, query, ответ, лог или аудит (§7/§16);
 *  - ни одного внешнего production-вызова: коннекторы выключены (§23 п.1);
 *  - подтверждение ручной проверки невозможно без evidence (§11);
 *  - refresh не правит прошлое: создаётся новый batch с supersedes_id (§13);
 *  - чужой tenant получает 404 без утечки самого факта существования (§16).
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { canAccessMortgageCase, mortgageRequestHash } from '../lib/mortgage-case.service';
import { iinLookupToken, maskIin, redactIinLike } from '../lib/mortgage-m02/iin';
import {
  EXTERNAL_SOURCE_REGISTRY,
  EXTERNAL_SOURCE_REGISTRY_VERSION,
  getSource,
  M02_CONSENT_PURPOSE,
} from '../lib/mortgage-m02/source-registry';
import { buildBatch, computeFreshUntil, type ConsentView } from '../lib/mortgage-m02/batch.service';
import { computeCoverage, buildFreshness, type CoverageInputResult } from '../lib/mortgage-m02/coverage';
import { humanMessage } from '../lib/mortgage-m02/not-found-mapper';

export const m02Router = Router();
m02Router.use(authenticate);
m02Router.use((req: Request, res: Response, next): void => {
  const supplied = req.header('X-Request-Id');
  res.locals.traceId = supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
  res.setHeader('X-Trace-Id', res.locals.traceId);
  next();
});

function apiError(res: Response, status: number, code: string, message: string, details?: unknown): void {
  res.status(status).json({
    error: {
      code,
      // Последний рубеж: даже если ИИН просочился в текст, наружу он не уйдёт.
      message: redactIinLike(message),
      ...(details === undefined ? {} : { details }),
      trace_id: res.locals.traceId,
    },
  });
}

function idempotencyKey(req: Request): string | null {
  const value = req.header('Idempotency-Key')?.trim();
  if (!value || value.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(value)) return null;
  return value;
}

// --- Схемы ------------------------------------------------------------------

const createBatchSchema = z.object({
  party_id: z.string().trim().min(1).max(128),
  /** ИИН принимается в теле POST и НИКОГДА в пути или query (§7). */
  iin: z.string().trim().min(1).max(32),
  identity_version: z.number().int().positive(),
  /** Условные проверки входят в знаменатель только с доказанным условием. */
  proven_conditional_check_types: z.array(z.string().max(64)).max(8).optional(),
}).strict();

const confirmTaskSchema = z.object({
  /** Наблюдённый исход. Отдельно от состояния задачи (§11). */
  outcome: z.enum(['FOUND', 'NOT_FOUND', 'ZERO', 'NOT_APPLICABLE', 'UNKNOWN']),
  evidence_ref: z.string().trim().min(1).max(512),
  evidence_hash: z.string().trim().min(16).max(128).optional(),
  checked_at: z.string().datetime(),
  source_data_as_of: z.string().datetime().nullable().optional(),
  comment: z.string().max(2000).optional(),
  facts: z.array(z.object({
    key: z.string().min(1).max(64),
    value: z.unknown(),
  })).max(32).optional(),
}).strict();

// --- Представления ----------------------------------------------------------

function batchView(batch: any, results?: any[]) {
  return {
    batch_id: batch.id,
    case_id: batch.caseId,
    tenant_id: batch.tenantId,
    tenant_scope_kind: batch.tenantScopeKind,
    participant: {
      party_id: batch.partyId,
      borrower_ref: batch.borrowerRef,
      // Единственная форма ИИН наружу.
      iin_masked: batch.iinMasked,
      identity_version: batch.identityVersion,
    },
    consent: {
      revision_id: batch.consentRevisionId,
      purpose: batch.consentPurpose,
    },
    manifest: {
      manifest_version: batch.manifestVersion,
      registry_version: batch.registryVersion,
      required_total: batch.requiredTotal,
      entries: batch.manifestJson,
    },
    coverage: batch.coverageJson,
    overall_status: batch.overallStatus,
    blocker_code: batch.blockerCode,
    actor_id: batch.actorId,
    requested_at: batch.requestedAt,
    supersedes_id: batch.supersedesId,
    superseded_by_id: batch.supersededById,
    created_at: batch.createdAt,
    ...(results ? { results: results.map(resultView) } : {}),
  };
}

function resultView(result: any) {
  const source = getSource(result.sourceCode);
  const freshness = buildFreshness({
    checkedAt: result.checkedAt,
    sourceDataAsOf: result.sourceDataAsOf,
    freshUntil: result.freshUntil,
    now: new Date(),
  });
  return {
    result_id: result.id,
    // Карточка источника (§15): владелец, канал, статус, даты, факты, evidence.
    source: {
      code: result.sourceCode,
      owner: result.sourceOwner,
      official_url: result.sourceUrl,
      check_type: result.checkType,
      automation_mode: result.automationMode,
      connector_enabled: source?.connectorEnabled ?? false,
    },
    required: result.required,
    // status и outcome отдаются РАЗДЕЛЬНО — они не взаимозаменяемы.
    status: result.status,
    outcome: result.outcome,
    error_category: result.errorCategory,
    retryable: result.retryable,
    reason: result.reason,
    upstream_code: result.upstreamCode,
    human_text: humanMessage(result.status, result.outcome, result.errorCategory, source),
    freshness,
    legal_basis_status: result.legalBasisStatus,
    consent_revision_id: result.consentRevisionId,
    evidence: {
      reference: result.evidenceRef,
      hash: result.evidenceHash,
      retention_policy_id: result.retentionPolicyId,
      present: result.evidenceRef !== null,
    },
    attempt: result.attempt,
    supersedes_id: result.supersedesId,
    superseded_by_id: result.supersededById,
    facts: (result.facts ?? []).map((f: any) => ({ key: f.factKey, value: f.factValue })),
    manual_tasks: (result.manualTasks ?? []).map(manualTaskView),
    created_at: result.createdAt,
    // Дисклеймер §17: факт источника не является решением банка.
    disclaimer: 'Факт источника — не решение банка.',
  };
}

function manualTaskView(task: any) {
  return {
    task_id: task.id,
    source_code: task.sourceCode,
    check_type: task.checkType,
    official_url: task.officialUrl,
    instruction: task.instruction,
    assignee_id: task.assigneeId,
    due_at: task.dueAt,
    expires_at: task.expiresAt,
    status: task.status,
    outcome: task.outcome,
    evidence: { reference: task.evidenceRef, hash: task.evidenceHash, present: task.evidenceRef !== null },
    checked_at: task.checkedAt,
    source_data_as_of: task.sourceDataAsOf,
    fresh_until: task.freshUntil,
    confirmed_by_actor_id: task.confirmedByActorId,
    confirmed_at: task.confirmedAt,
    comment: task.comment,
  };
}

// --- Общие загрузчики с проверкой области доступа ---------------------------

/**
 * Загружает batch и проверяет доступ. Возвращает null и для «не найден», и для
 * «чужой» — вызывающий обязан ответить одинаковым 404, чтобы не подтверждать
 * существование чужой записи (§16 tenant isolation).
 */
async function loadBatch(batchId: string, user: any, include?: Prisma.ClientCheckBatchInclude) {
  const batch = await prisma.clientCheckBatch.findUnique({
    where: { id: batchId },
    include: { mortgageCase: true, ...(include ?? {}) },
  });
  if (!batch) return null;
  if (!canAccessMortgageCase(batch.mortgageCase, user)) return null;
  return batch;
}

async function recomputeCoverage(batchId: string, now = new Date()) {
  const batch = await prisma.clientCheckBatch.findUnique({
    where: { id: batchId },
    include: { results: true },
  });
  if (!batch) return null;

  const input: CoverageInputResult[] = batch.results
    .filter((r) => r.supersededById === null)
    .map((r) => ({
      checkType: r.checkType,
      required: r.required,
      status: r.status as CoverageInputResult['status'],
      outcome: (r.outcome ?? null) as CoverageInputResult['outcome'],
      evidenceValid: r.evidenceRef !== null,
      stale: r.freshUntil !== null && r.freshUntil.getTime() <= now.getTime(),
    }));

  const coverage = computeCoverage(batch.requiredTotal, input, {
    consentBlocked: batch.blockerCode === 'BLOCKED_CONSENT',
    legalBlocked: batch.blockerCode === 'BLOCKED_LEGAL',
  });

  await prisma.clientCheckBatch.update({
    where: { id: batchId },
    data: {
      coverageJson: coverage as unknown as Prisma.InputJsonValue,
      overallStatus: coverage.overallStatus,
    },
  });
  return coverage;
}

// --- Реестр источников (read-only, admin/audit) -----------------------------

/**
 * Не входит в 45 канонических контрактов: это read-only витрина versioned
 * реестра, чтобы состав, режимы и выключенность коннекторов можно было
 * предъявить как evidence (AT-IIN-001/002/003), не читая исходники.
 */
m02Router.get('/source-registry', (_req: Request, res: Response): void => {
  res.json({
    data: {
      registry_version: EXTERNAL_SOURCE_REGISTRY_VERSION,
      consent_purpose: M02_CONSENT_PURPOSE,
      sources: EXTERNAL_SOURCE_REGISTRY.map((s) => ({
        code: s.code,
        check_type: s.checkType,
        source_class: s.sourceClass,
        owner: s.owner,
        official_url: s.officialUrl,
        automation_mode_r0: s.automationModeR0,
        consent_required: s.consentRequired,
        legal_status: s.legalStatus,
        captcha_expected: s.captchaExpected,
        connector_enabled: s.connectorEnabled,
        no_match_contract: s.noMatchContract,
        freshness_ttl_seconds: s.freshnessTtlSeconds,
        fact_allowlist: s.factAllowlist,
        blocks_clean: s.blocksClean,
      })),
    },
  });
});

// --- API-M02-001 ------------------------------------------------------------

m02Router.post('/cases/:caseId/iin-check-batches', async (req: Request, res: Response): Promise<void> => {
  const key = idempotencyKey(req);
  if (!key) {
    apiError(res, 400, 'idempotency_key_required', 'Требуется корректный заголовок Idempotency-Key');
    return;
  }
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
    return;
  }

  const actorId = req.user!.userId;
  const now = new Date();

  try {
    const mortgageCase = await prisma.mortgageCase.findUnique({
      where: { id: req.params.caseId },
      include: { parties: { include: { consentRevision: true } } },
    });
    if (!mortgageCase || !canAccessMortgageCase(mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Ипотечный кейс не найден');
      return;
    }

    const party = mortgageCase.parties.find((p) => p.id === parsed.data.party_id);
    if (!party) {
      apiError(res, 404, 'not_found', 'Участник не найден в этом кейсе');
      return;
    }

    // Согласие берётся ИМЕННО этого участника: согласие другого не покрывает.
    const consent: ConsentView | null = party.consentRevision
      ? {
        id: party.consentRevision.id,
        purposeCode: party.consentRevision.purposeCode,
        status: party.consentRevision.status,
        grantedAt: party.consentRevision.grantedAt,
        expiresAt: party.consentRevision.expiresAt,
        revokedAt: party.consentRevision.revokedAt,
      }
      : null;

    // Идемпотентность: тот же ключ и тот же запрос → существующий batch.
    const requestHash = mortgageRequestHash({
      caseId: mortgageCase.id,
      partyId: parsed.data.party_id,
      identityVersion: parsed.data.identity_version,
      // В хэш идёт токен, а не ИИН: сам ИИН нигде не сохраняется.
      subject: safeLookupToken(parsed.data.iin),
    });
    const existing = await prisma.clientCheckBatch.findFirst({
      where: { caseId: mortgageCase.id, idempotencyKey: key },
      include: { results: { include: { facts: true, manualTasks: true } } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        apiError(res, 409, 'idempotency_conflict', 'Idempotency-Key уже использован с другим запросом');
        return;
      }
      res.status(200).json({ data: batchView(existing, existing.results) });
      return;
    }

    const built = buildBatch({
      iin: parsed.data.iin,
      identityVersion: parsed.data.identity_version,
      consent,
      now,
      provenConditionalCheckTypes: parsed.data.proven_conditional_check_types,
    });

    const created = await prisma.$transaction(async (tx) => {
      const batch = await tx.clientCheckBatch.create({
        data: {
          tenantId: mortgageCase.ownerId,
          tenantScopeKind: 'CASE_OWNER',
          caseId: mortgageCase.id,
          partyId: party.id,
          borrowerRef: party.clientId,
          iinMasked: maskIin(parsed.data.iin),
          iinLookupToken: safeLookupToken(parsed.data.iin),
          identityVersion: parsed.data.identity_version,
          consentRevisionId: consent?.id ?? null,
          consentPurpose: M02_CONSENT_PURPOSE,
          manifestVersion: built.manifest.manifestVersion,
          registryVersion: built.manifest.registryVersion,
          manifestJson: built.manifest.entries as unknown as Prisma.InputJsonValue,
          requiredTotal: built.manifest.requiredTotal,
          actorId,
          overallStatus: built.coverage.overallStatus,
          coverageJson: built.coverage as unknown as Prisma.InputJsonValue,
          blockerCode: built.blockerCode,
          idempotencyKey: key,
          requestHash,
        },
      });

      for (const planned of built.results) {
        const result = await tx.clientCheckResult.create({
          data: {
            batchId: batch.id,
            tenantId: batch.tenantId,
            sourceCode: planned.sourceCode,
            sourceOwner: planned.sourceOwner,
            sourceUrl: planned.sourceUrl,
            checkType: planned.checkType,
            automationMode: planned.automationMode,
            required: planned.required,
            status: planned.status,
            outcome: planned.outcome ?? null,
            errorCategory: planned.errorCategory,
            retryable: planned.retryable,
            reason: planned.reason,
            upstreamCode: planned.upstreamCode,
            checkedAt: planned.checkedAt,
            sourceDataAsOf: planned.sourceDataAsOf,
            freshUntil: planned.freshUntil,
            legalBasisStatus: planned.legalBasisStatus,
            consentRevisionId: consent?.id ?? null,
            retentionPolicyId: 'casa.retention.m02/1.0.0',
          },
        });

        // Ручная задача создаётся только там, где маршрут действительно ручной,
        // и только если гейты пройдены: без согласия задач не заводим.
        if (planned.needsManualTask && built.blockerCode === null) {
          await tx.manualCheckTask.create({
            data: {
              batchId: batch.id,
              resultId: result.id,
              tenantId: batch.tenantId,
              sourceCode: planned.sourceCode,
              checkType: planned.checkType,
              officialUrl: planned.sourceUrl,
              instruction: planned.instruction,
              assigneeId: actorId,
              expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: mortgageCase.id,
          actorId,
          action: 'm02.iin_check_batch.created',
          objectType: 'ClientCheckBatch',
          objectId: batch.id,
          purpose: M02_CONSENT_PURPOSE,
          result: built.blockerCode ? 'DENY' : 'SUCCESS',
          reasonCode: built.blockerCode ?? built.coverage.overallStatus,
          metadataHash: requestHash,
        },
      });

      return batch.id;
    });

    const full = await prisma.clientCheckBatch.findUnique({
      where: { id: created },
      include: { results: { include: { facts: true, manualTasks: true } } },
    });
    res.status(201).json({ data: batchView(full, full!.results) });
  } catch (error) {
    console.error('M02 batch creation failed', { code: (error as { code?: string })?.code ?? 'unknown' });
    apiError(res, 500, 'internal_error', 'Не удалось создать проверку');
  }
});

/**
 * Токен поиска. Если ключ HMAC не настроен, batch всё равно должен создаться
 * (гейты и покрытие от него не зависят), но токен не подделывается: пишем
 * явный маркер отсутствия, а не обратимый хэш от ИИН.
 */
function safeLookupToken(iin: string): string {
  try {
    return iinLookupToken(iin);
  } catch {
    return 'LOOKUP_TOKEN_UNAVAILABLE';
  }
}

// --- API-M02-002 ------------------------------------------------------------

m02Router.get('/iin-check-batches/:batchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const batch = await loadBatch(req.params.batchId, req.user!);
    if (!batch) { apiError(res, 404, 'not_found', 'Проверка не найдена'); return; }
    res.json({ data: batchView(batch) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить проверку');
  }
});

// --- API-M02-003 ------------------------------------------------------------

m02Router.get('/iin-check-batches/:batchId/results', async (req: Request, res: Response): Promise<void> => {
  try {
    const batch = await loadBatch(req.params.batchId, req.user!, {
      results: { include: { facts: true, manualTasks: true }, orderBy: { createdAt: 'asc' } },
    } as Prisma.ClientCheckBatchInclude);
    if (!batch) { apiError(res, 404, 'not_found', 'Проверка не найдена'); return; }
    const results = (batch as any).results ?? [];
    res.json({
      data: {
        batch_id: batch.id,
        coverage: batch.coverageJson,
        overall_status: batch.overallStatus,
        results: results.map(resultView),
      },
    });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить результаты');
  }
});

// --- API-M02-004 ------------------------------------------------------------

m02Router.post('/iin-check-results/:resultId/retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await prisma.clientCheckResult.findUnique({
      where: { id: req.params.resultId },
      include: { batch: { include: { mortgageCase: true } } },
    });
    if (!result || !canAccessMortgageCase(result.batch.mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Результат не найден');
      return;
    }
    if (result.supersededById !== null) {
      apiError(res, 409, 'result_superseded', 'Результат уже заменён более новым');
      return;
    }
    // Повторять можно ТОЛЬКО retryable-ошибку источника. Ручную задачу,
    // отсутствие согласия или запрет повтором не «пробить».
    if (!result.retryable) {
      apiError(res, 422, 'not_retryable',
        'Повтор допустим только для временной ошибки источника. Используйте разрешённый маршрут проверки.');
      return;
    }

    const retried = await prisma.$transaction(async (tx) => {
      // Коннекторы выключены: повтор честно возвращает ту же недоступность,
      // а не выдумывает результат. Новая попытка — новая иммутабельная запись.
      const next = await tx.clientCheckResult.create({
        data: {
          batchId: result.batchId,
          tenantId: result.tenantId,
          sourceCode: result.sourceCode,
          sourceOwner: result.sourceOwner,
          sourceUrl: result.sourceUrl,
          checkType: result.checkType,
          automationMode: result.automationMode,
          required: result.required,
          status: 'UNAVAILABLE',
          outcome: null,
          errorCategory: 'ACCESS_REQUIRED',
          retryable: false,
          reason: 'Повтор выполнен: автоматический коннектор выключен (R0)',
          legalBasisStatus: result.legalBasisStatus,
          consentRevisionId: result.consentRevisionId,
          retentionPolicyId: result.retentionPolicyId,
          attempt: result.attempt + 1,
          supersedesId: result.id,
        },
      });
      await tx.clientCheckResult.update({
        where: { id: result.id },
        data: { supersededById: next.id },
      });
      await tx.mortgageAuditEvent.create({
        data: {
          caseId: result.batch.caseId,
          actorId: req.user!.userId,
          action: 'm02.iin_check_result.retried',
          objectType: 'ClientCheckResult',
          objectId: next.id,
          purpose: M02_CONSENT_PURPOSE,
          result: 'SUCCESS',
          reasonCode: 'CONNECTOR_DISABLED',
        },
      });
      return next;
    });

    await recomputeCoverage(result.batchId);
    res.status(201).json({ data: resultView(retried) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось повторить проверку');
  }
});

// --- API-M02-005 ------------------------------------------------------------

m02Router.post('/manual-check-tasks/:taskId/confirm', async (req: Request, res: Response): Promise<void> => {
  const parsed = confirmTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    // Отсутствие evidence отсекается здесь же: «записей нет» без доказательства
    // не принимается ни при каких условиях (§11).
    apiError(res, 422, 'manual_evidence_required',
      'Подтверждение требует наблюдённого исхода, evidence и времени проверки', parsed.error.flatten());
    return;
  }

  try {
    const task = await prisma.manualCheckTask.findUnique({
      where: { id: req.params.taskId },
      include: { batch: { include: { mortgageCase: true } }, result: true },
    });
    if (!task || !canAccessMortgageCase(task.batch.mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Задача не найдена');
      return;
    }
    if (task.status === 'CONFIRMED') {
      apiError(res, 409, 'already_confirmed', 'Задача уже подтверждена; исправление создаёт новую версию результата');
      return;
    }
    const now = new Date();
    if (task.expiresAt && task.expiresAt.getTime() <= now.getTime()) {
      apiError(res, 409, 'task_expired', 'Срок задачи истёк: подтверждение невозможно, создайте новую проверку');
      return;
    }

    const source = getSource(task.sourceCode);
    // NOT_FOUND принимается только там, где у источника есть документированный
    // ручной контракт «нет записей». Иначе оператор не может доказать негатив.
    if (parsed.data.outcome === 'NOT_FOUND' && !source?.noMatchContract) {
      apiError(res, 422, 'not_found_not_supported',
        'Для этого источника доказанное отсутствие записей не определено. Зафиксируйте фактический исход.');
      return;
    }

    const checkedAt = new Date(parsed.data.checked_at);
    const freshUntil = computeFreshUntil(checkedAt, source?.freshnessTtlSeconds ?? null);
    const allowlist = new Set(source?.factAllowlist ?? []);
    const facts = (parsed.data.facts ?? []).filter((f) => allowlist.has(f.key));

    const updated = await prisma.$transaction(async (tx) => {
      // Прошлое не переписывается: подтверждение создаёт НОВЫЙ result,
      // а прежний помечается заменённым.
      const next = await tx.clientCheckResult.create({
        data: {
          batchId: task.batchId,
          tenantId: task.tenantId,
          sourceCode: task.result.sourceCode,
          sourceOwner: task.result.sourceOwner,
          sourceUrl: task.result.sourceUrl,
          checkType: task.result.checkType,
          automationMode: task.result.automationMode,
          required: task.result.required,
          status: 'COMPLETED',
          outcome: parsed.data.outcome,
          errorCategory: null,
          retryable: false,
          reason: `Ручное подтверждение оператором (${source?.noMatchContract ?? 'MANUAL_OFFICIAL'})`,
          upstreamCode: parsed.data.outcome === 'NOT_FOUND' ? source?.noMatchContract ?? null : null,
          checkedAt,
          sourceDataAsOf: parsed.data.source_data_as_of ? new Date(parsed.data.source_data_as_of) : null,
          freshUntil,
          legalBasisStatus: task.result.legalBasisStatus,
          consentRevisionId: task.result.consentRevisionId,
          evidenceRef: parsed.data.evidence_ref,
          evidenceHash: parsed.data.evidence_hash ?? null,
          retentionPolicyId: task.result.retentionPolicyId,
          attempt: task.result.attempt + 1,
          supersedesId: task.result.id,
        },
      });
      await tx.clientCheckResult.update({
        where: { id: task.result.id },
        data: { supersededById: next.id },
      });

      for (const f of facts) {
        await tx.clientCheckFact.create({
          data: {
            resultId: next.id,
            tenantId: task.tenantId,
            factKey: f.key,
            factValue: (f.value ?? null) as Prisma.InputJsonValue,
          },
        });
      }

      const done = await tx.manualCheckTask.update({
        where: { id: task.id },
        data: {
          status: 'CONFIRMED',
          outcome: parsed.data.outcome,
          evidenceRef: parsed.data.evidence_ref,
          evidenceHash: parsed.data.evidence_hash ?? null,
          checkedAt,
          sourceDataAsOf: parsed.data.source_data_as_of ? new Date(parsed.data.source_data_as_of) : null,
          freshUntil,
          confirmedByActorId: req.user!.userId,
          confirmedAt: now,
          comment: parsed.data.comment ?? null,
          resultId: next.id,
        },
      });

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: task.batch.caseId,
          actorId: req.user!.userId,
          action: 'm02.manual_check_task.confirmed',
          objectType: 'ManualCheckTask',
          objectId: task.id,
          purpose: M02_CONSENT_PURPOSE,
          result: 'SUCCESS',
          reasonCode: parsed.data.outcome,
          metadataHash: parsed.data.evidence_hash ?? null,
        },
      });

      return done;
    });

    const coverage = await recomputeCoverage(task.batchId);
    res.json({ data: { task: manualTaskView(updated), coverage } });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось подтвердить проверку');
  }
});

// --- API-M02-006 ------------------------------------------------------------

m02Router.post('/iin-check-batches/:batchId/refresh', async (req: Request, res: Response): Promise<void> => {
  const key = idempotencyKey(req);
  if (!key) {
    apiError(res, 400, 'idempotency_key_required', 'Требуется корректный заголовок Idempotency-Key');
    return;
  }
  try {
    const previous = await prisma.clientCheckBatch.findUnique({
      where: { id: req.params.batchId },
      include: { mortgageCase: { include: { parties: { include: { consentRevision: true } } } } },
    });
    if (!previous || !canAccessMortgageCase(previous.mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Проверка не найдена');
      return;
    }
    if (previous.supersededById !== null) {
      apiError(res, 409, 'already_superseded', 'Эта проверка уже обновлена');
      return;
    }

    const party = previous.mortgageCase.parties.find((p) => p.id === previous.partyId);
    const consent: ConsentView | null = party?.consentRevision
      ? {
        id: party.consentRevision.id,
        purposeCode: party.consentRevision.purposeCode,
        status: party.consentRevision.status,
        grantedAt: party.consentRevision.grantedAt,
        expiresAt: party.consentRevision.expiresAt,
        revokedAt: party.consentRevision.revokedAt,
      }
      : null;

    const now = new Date();
    // Refresh заново проходит consent и source gates (§13): согласие могло быть
    // отозвано с момента прошлого прогона.
    const built = buildBatch({
      // ИИН не хранится: привязка субъекта наследуется из прошлого batch.
      // Гейт ИИН пропускается явным флагом, а consent и source gates
      // проверяются заново — согласие могло быть отозвано (§13).
      iin: null,
      subjectAlreadyBound: true,
      identityVersion: previous.identityVersion,
      consent,
      now,
    });
    const consentDecision = built.blockerCode;

    const created = await prisma.$transaction(async (tx) => {
      const batch = await tx.clientCheckBatch.create({
        data: {
          tenantId: previous.tenantId,
          tenantScopeKind: previous.tenantScopeKind,
          caseId: previous.caseId,
          partyId: previous.partyId,
          borrowerRef: previous.borrowerRef,
          iinMasked: previous.iinMasked,
          iinLookupToken: previous.iinLookupToken,
          identityVersion: previous.identityVersion,
          consentRevisionId: consent?.id ?? null,
          consentPurpose: M02_CONSENT_PURPOSE,
          manifestVersion: built.manifest.manifestVersion,
          registryVersion: built.manifest.registryVersion,
          manifestJson: built.manifest.entries as unknown as Prisma.InputJsonValue,
          requiredTotal: built.manifest.requiredTotal,
          actorId: req.user!.userId,
          overallStatus: built.coverage.overallStatus,
          coverageJson: built.coverage as unknown as Prisma.InputJsonValue,
          blockerCode: consentDecision,
          idempotencyKey: key,
          requestHash: mortgageRequestHash({ refreshOf: previous.id }),
          supersedesId: previous.id,
        },
      });

      for (const planned of built.results) {
        const result = await tx.clientCheckResult.create({
          data: {
            batchId: batch.id,
            tenantId: batch.tenantId,
            sourceCode: planned.sourceCode,
            sourceOwner: planned.sourceOwner,
            sourceUrl: planned.sourceUrl,
            checkType: planned.checkType,
            automationMode: planned.automationMode,
            required: planned.required,
            status: planned.status,
            outcome: planned.outcome ?? null,
            errorCategory: planned.errorCategory,
            retryable: planned.retryable,
            reason: planned.reason,
            upstreamCode: planned.upstreamCode,
            // Проверка не выполнялась: три временные характеристики — явный
            // UNKNOWN, а не «сейчас».
            checkedAt: null,
            sourceDataAsOf: null,
            freshUntil: null,
            legalBasisStatus: planned.legalBasisStatus,
            consentRevisionId: consent?.id ?? null,
            retentionPolicyId: 'casa.retention.m02/1.0.0',
          },
        });
        if (planned.needsManualTask && consentDecision === null) {
          await tx.manualCheckTask.create({
            data: {
              batchId: batch.id,
              resultId: result.id,
              tenantId: batch.tenantId,
              sourceCode: planned.sourceCode,
              checkType: planned.checkType,
              officialUrl: planned.sourceUrl,
              instruction: planned.instruction,
              assigneeId: req.user!.userId,
              expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      // Старый batch остаётся видимым и неизменным — помечается только ссылка.
      await tx.clientCheckBatch.update({
        where: { id: previous.id },
        data: { supersededById: batch.id },
      });

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: previous.caseId,
          actorId: req.user!.userId,
          action: 'm02.iin_check_batch.refreshed',
          objectType: 'ClientCheckBatch',
          objectId: batch.id,
          purpose: M02_CONSENT_PURPOSE,
          result: 'SUCCESS',
          reasonCode: batch.overallStatus,
        },
      });
      return batch.id;
    });

    const full = await prisma.clientCheckBatch.findUnique({
      where: { id: created },
      include: { results: { include: { facts: true, manualTasks: true } } },
    });
    res.status(201).json({ data: batchView(full, full!.results) });
  } catch (error) {
    console.error('M02 refresh failed', error);
    apiError(res, 500, 'internal_error', 'Не удалось обновить проверку');
  }
});

export default m02Router;
