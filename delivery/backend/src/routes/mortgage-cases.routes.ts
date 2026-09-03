import crypto from 'crypto';
import { findPurpose, isKnownOperation } from '../lib/mortgage-m01/purpose-registry';
import { Prisma, MortgageCaseStatus } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  canAccessMortgageCase,
  canTransitionMortgageCase,
  isActiveMortgageConsent,
  mortgageRequestHash,
} from '../lib/mortgage-case.service';
import {
  runCalculation,
  M06_SCHEMA_VERSION,
  M06_ENGINE_VERSION,
  M06_DECIMAL_CONTEXT_VERSION,
  type CalculationRunContext,
} from '../lib/mortgage-workspace/mortgage-calc.service';
import type { InputStatus } from '../lib/mortgage-workspace/m06-calc';
import {
  resolveRequestedCalculations,
  FormulaNotAllowedError,
  M06_FORMULA_REGISTRY_VERSION,
} from '../lib/mortgage-workspace/m06-formula-registry';
import { aggregateMoney, profileContentHash, type MoneySource } from '../lib/mortgage-workspace/mortgage-profile.service';

export const mortgageCasesRouter = Router();
mortgageCasesRouter.use(authenticate);
mortgageCasesRouter.use((req: Request, res: Response, next): void => {
  const supplied = req.header('X-Request-Id');
  const traceId = supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
  res.locals.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
});

const createCaseSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
}).strict();

const patchCaseSchema = z.object({
  expected_version: z.number().int().positive(),
  status: z.nativeEnum(MortgageCaseStatus),
}).strict();
const addPartySchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  role: z.enum(['CO_BORROWER', 'GUARANTOR']),
  consent_revision_id: z.string().trim().min(1).max(128),
  expected_version: z.number().int().positive(),
}).strict();

function apiError(res: Response, status: number, code: string, message: string, details?: unknown): void {
  res.status(status).json({
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
      trace_id: res.locals.traceId,
    },
  });
}

function caseResponse(value: any) {
  return {
    id: value.id,
    client_id: value.clientId,
    owner_id: value.ownerId,
    status: value.status,
    version: value.version,
    latest_snapshot_id: value.latestSnapshotId ?? null,
    latest_result_id: value.latestResultId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    ...(value.parties === undefined ? {} : { parties: value.parties }),
    ...(value.grants === undefined ? {} : { recipient_grants: value.grants }),
  };
}

function idempotencyKey(req: Request): string | null {
  const value = req.header('Idempotency-Key')?.trim();
  if (!value || value.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(value)) return null;
  return value;
}

async function runSerializable<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : (error as { code?: string })?.code;
      if (code !== 'P2034' || attempt === 1) throw error;
    }
  }
  throw new Error('Serializable transaction retry exhausted');
}

mortgageCasesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const key = idempotencyKey(req);
  if (!key) {
    apiError(res, 400, 'idempotency_key_required', 'Требуется корректный заголовок Idempotency-Key');
    return;
  }

  const parsed = createCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
    return;
  }

  const actorId = req.user!.userId;
  const operation = 'mortgage_case.create';
  const requestHash = mortgageRequestHash(parsed.data);
  const uniqueWhere = { actorId_operation_key: { actorId, operation, key } };

  try {
    const result = await runSerializable(async (tx) => {
      const existing = await tx.mortgageIdempotencyRecord.findUnique({ where: uniqueWhere });
      if (existing && existing.expiresAt > new Date()) {
        if (existing.requestHash !== requestHash) {
          return { kind: 'conflict' as const };
        }
        if (existing.responseStatus && existing.responseBody) {
          return {
            kind: 'replay' as const,
            status: existing.responseStatus,
            body: existing.responseBody,
          };
        }
        return { kind: 'in_progress' as const };
      }
      if (existing) {
        await tx.mortgageIdempotencyRecord.delete({ where: uniqueWhere });
      }

      const client = await tx.client.findUnique({
        where: { id: parsed.data.client_id },
        select: { id: true, brokerId: true },
      });
      if (!client || (req.user!.role !== 'ADMIN' && client.brokerId !== actorId)) {
        return { kind: 'client_not_found' as const };
      }

      const mortgageCase = await tx.mortgageCase.create({
        data: { clientId: client.id, ownerId: actorId },
      });
      await tx.mortgageCaseParty.create({
        // M01-CAN-0138: основной заёмщик включён в анализ по своему профилю.
        // Остальные роли добавляются с included_in_analysis=false.
        data: { caseId: mortgageCase.id, clientId: client.id, role: 'PRIMARY', includedInAnalysis: true },
      });

      const body = { data: caseResponse(mortgageCase) };
      await tx.mortgageAuditEvent.create({
        data: {
          caseId: mortgageCase.id,
          actorId,
          action: 'mortgage_case.created',
          objectType: 'MortgageCase',
          objectId: mortgageCase.id,
          purpose: 'mortgage_prescore',
          result: 'SUCCESS',
          metadataHash: requestHash,
        },
      });
      await tx.mortgageIdempotencyRecord.create({
        data: {
          actorId,
          operation,
          key,
          requestHash,
          responseStatus: 201,
          responseBody: body as Prisma.InputJsonValue,
          resourceId: mortgageCase.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { kind: 'created' as const, status: 201, body };
    });

    if (result.kind === 'conflict') {
      apiError(res, 409, 'idempotency_conflict', 'Idempotency-Key уже использован с другим запросом');
      return;
    }
    if (result.kind === 'in_progress') {
      apiError(res, 409, 'request_in_progress', 'Запрос с этим Idempotency-Key ещё выполняется');
      return;
    }
    if (result.kind === 'client_not_found') {
      apiError(res, 404, 'client_not_found', 'Клиент не найден');
      return;
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    const errorCode = error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : (error as { code?: string })?.code;

    // Two serializable requests may both observe an empty key; the database
    // unique constraint elects one winner. Replay that committed response.
    if (errorCode === 'P2002') {
      const winner = await prisma.mortgageIdempotencyRecord.findUnique({ where: uniqueWhere });
      if (
        winner
        && winner.expiresAt > new Date()
        && winner.requestHash === requestHash
        && winner.responseStatus
        && winner.responseBody
      ) {
        res.status(winner.responseStatus).json(winner.responseBody);
        return;
      }
      if (winner && winner.requestHash !== requestHash) {
        apiError(res, 409, 'idempotency_conflict', 'Idempotency-Key уже использован с другим запросом');
        return;
      }
    }

    console.error('Create mortgage case failed', { actorId, code: errorCode ?? 'unknown' });
    apiError(res, 500, 'internal_error', 'Не удалось создать ипотечный кейс');
  }
});

// canonical DEC-API-001: /participants — основной путь (API-M01-002 / M05-003);
// /parties сохранён как алиас для обратной совместимости.
mortgageCasesRouter.post(['/:id/participants', '/:id/parties'], async (req: Request, res: Response): Promise<void> => {
  const parsed = addPartySchema.safeParse(req.body);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
    return;
  }

  try {
    const result = await runSerializable(async (tx) => {
      const current = await tx.mortgageCase.findUnique({ where: { id: req.params.id } });
      if (!current || !canAccessMortgageCase(current, req.user!)) {
        return { kind: 'not_found' as const };
      }
      if (current.version !== parsed.data.expected_version) {
        return { kind: 'version_conflict' as const };
      }

      const consentRevision = await tx.consentRevision.findUnique({
        where: { id: parsed.data.consent_revision_id },
        include: { consent: { select: { clientId: true } } },
      });
      if (
        !consentRevision
        || consentRevision.consent.clientId !== parsed.data.client_id
        || !isActiveMortgageConsent(
          consentRevision,
          'collect_and_process_questionnaire_data',
        )
      ) {
        return { kind: 'consent_required' as const };
      }

      const mutation = await tx.mortgageCase.updateMany({
        where: { id: current.id, version: parsed.data.expected_version },
        data: { version: { increment: 1 } },
      });
      if (mutation.count !== 1) return { kind: 'version_conflict' as const };

      const party = await tx.mortgageCaseParty.create({
        data: {
          caseId: current.id,
          clientId: parsed.data.client_id,
          role: parsed.data.role,
          consentRevisionId: consentRevision.id,
        },
      });
      const mortgageCase = await tx.mortgageCase.findUnique({ where: { id: current.id } });
      if (!mortgageCase) throw new Error('Mortgage case disappeared after party creation');

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: current.id,
          actorId: req.user!.userId,
          action: 'mortgage_case.party_added',
          objectType: 'MortgageCaseParty',
          objectId: party.id,
          purpose: 'mortgage_prescore',
          result: 'SUCCESS',
          metadataHash: mortgageRequestHash({
            client_id: parsed.data.client_id,
            role: parsed.data.role,
            consent_revision_id: parsed.data.consent_revision_id,
          }),
        },
      });
      return { kind: 'created' as const, party, mortgageCase };
    });

    if (result.kind === 'not_found') {
      apiError(res, 404, 'not_found', 'Ипотечный кейс не найден');
      return;
    }
    if (result.kind === 'version_conflict') {
      apiError(res, 409, 'version_conflict', 'Кейс был изменён другим запросом');
      return;
    }
    if (result.kind === 'consent_required') {
      apiError(
        res,
        409,
        'CONSENT_REQUIRED',
        'Для участника требуется активное согласие на обработку ипотечной анкеты',
      );
      return;
    }
    res.status(201).json({
      data: {
        party: result.party,
        case: caseResponse(result.mortgageCase),
      },
    });
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : (error as { code?: string })?.code;
    if (code === 'P2002') {
      apiError(res, 409, 'party_already_exists', 'Участник с этой ролью уже добавлен');
      return;
    }
    apiError(res, 500, 'internal_error', 'Не удалось добавить участника');
  }
});
/**
 * GET /api/v2/cases — DEC-API-002, auxiliary case-list read endpoint.
 *
 * НЕ является 46-м каноническим контрактом: в 06_API_CONTRACTS.csv на этом пути
 * определён только POST (API-M01-001), и список 45 frozen API не меняется. Это
 * вспомогательная read surface над уже существующим case: без неё UI обязан
 * либо знать case_id заранее, либо снова скатиться в mock.
 *
 * Требования (owner decision): только доступные актору кейсы, изоляция области
 * доступа, пагинация, детерминированный порядок, минимальный allowlist полей,
 * никаких лишних ПД, read-only, отсутствие cross-scope existence leak.
 */
const listCasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(128).optional(),
}).strict();

/**
 * Минимальный allowlist полей списка. Сознательно НЕ отдаём client_id и
 * owner_id: для выбора кейса они не нужны, а любое лишнее поле здесь — это
 * персональные данные в списковой выдаче.
 */
function caseListItem(value: {
  id: string; status: string; version: number; updatedAt: Date; createdAt: Date;
}) {
  return {
    id: value.id,
    status: value.status,
    version: value.version,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

mortgageCasesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listCasesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Некорректные параметры списка', parsed.error.flatten());
    return;
  }
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const { limit, cursor } = parsed.data;

    // Сортировка по updatedAt может давать одинаковые значения, поэтому id —
    // обязательный tie-breaker: без него курсорная страница способна потерять
    // или продублировать строку.
    const rows = await prisma.mortgageCase.findMany({
      where: isAdmin ? {} : { ownerId: req.user!.userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, status: true, version: true, createdAt: true, updatedAt: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      data: page.map(caseListItem),
      page_info: {
        has_more: hasMore,
        next_cursor: hasMore ? page[page.length - 1].id : null,
        limit,
      },
    });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить список кейсов');
  }
});

mortgageCasesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const mortgageCase = await prisma.mortgageCase.findUnique({
      where: { id: req.params.id },
      include: {
        parties: { orderBy: { createdAt: 'asc' } },
        grants: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!mortgageCase || !canAccessMortgageCase(mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Ипотечный кейс не найден');
      return;
    }
    res.json({ data: caseResponse(mortgageCase) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить ипотечный кейс');
  }
});

mortgageCasesRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = patchCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
    return;
  }

  try {
    const result = await runSerializable(async (tx) => {
      const current = await tx.mortgageCase.findUnique({
        where: { id: req.params.id },
        include: {
          parties: {
            include: { consentRevision: true },
          },
        },
      });
      if (!current || !canAccessMortgageCase(current, req.user!)) {
        return { kind: 'not_found' as const };
      }
      if (current.version !== parsed.data.expected_version) {
        return { kind: 'version_conflict' as const };
      }
      if (!canTransitionMortgageCase(current.status, parsed.data.status)) {
        return { kind: 'invalid_transition' as const };
      }

      const consentGuardedStatuses: MortgageCaseStatus[] = [
        MortgageCaseStatus.DOCUMENTS_PENDING,
        MortgageCaseStatus.PROCESSING,
        MortgageCaseStatus.REVIEW_REQUIRED,
        MortgageCaseStatus.READY_TO_CALCULATE,
        MortgageCaseStatus.ACTIVE,
      ];
      if (
        consentGuardedStatuses.includes(parsed.data.status)
        && (
          current.parties.length === 0
          || current.parties.some(
            (party) => !party.consentRevision
              || !isActiveMortgageConsent(
                party.consentRevision,
                'calculate_preliminary_mortgage_options',
              ),
          )
        )
      ) {
        return { kind: 'consent_required' as const };
      }

      const mutation = await tx.mortgageCase.updateMany({
        where: { id: current.id, version: parsed.data.expected_version },
        data: { status: parsed.data.status, version: { increment: 1 } },
      });
      if (mutation.count !== 1) return { kind: 'version_conflict' as const };

      const value = await tx.mortgageCase.findUnique({ where: { id: current.id } });
      if (!value) throw new Error('Mortgage case disappeared after update');

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: current.id,
          actorId: req.user!.userId,
          action: 'mortgage_case.status_changed',
          objectType: 'MortgageCase',
          objectId: current.id,
          purpose: 'mortgage_prescore',
          result: 'SUCCESS',
          reasonCode: parsed.data.status,
          metadataHash: mortgageRequestHash({
            from: current.status,
            to: parsed.data.status,
            expected_version: parsed.data.expected_version,
          }),
        },
      });
      return { kind: 'updated' as const, value };
    });

    if (result.kind === 'not_found') {
      apiError(res, 404, 'not_found', 'Ипотечный кейс не найден');
      return;
    }
    if (result.kind === 'version_conflict') {
      apiError(res, 409, 'version_conflict', 'Кейс был изменён другим запросом');
      return;
    }
    if (result.kind === 'invalid_transition') {
      apiError(res, 409, 'invalid_state_transition', 'Переход статуса запрещён');
      return;
    }
    if (result.kind === 'consent_required') {
      apiError(res, 409, 'CONSENT_REQUIRED', 'Для перехода требуется активное согласие всех участников');
      return;
    }
    res.json({ data: caseResponse(result.value) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось изменить ипотечный кейс');
  }
});
// =========================================================================
// M06 Calculation Engine — canonical эндпоинты (API-M06-001..003).
// INV-0032 "NO PDF": на вход только параметры/статусы, не документы. Прогон
// идемпотентен (Idempotency-Key), снапшот иммутабелен (input_hash/output_hash).
// =========================================================================

/**
 * §21: прогон принимает ТОЛЬКО ссылку на опубликованный снапшот профиля M05 и
 * явные расчётные параметры. Денежные величины из тела запроса не принимаются
 * вовсе — иначе клиент смог бы подсунуть цифру мимо профиля, и снапшот перестал
 * бы быть «sole profile data source». `.strict()` отвергает и старые ключи
 * (target_price_max / available_now_total) как unknown field.
 */
const calcRunSchema = z.object({
  client_profile_snapshot_id: z.string().trim().min(1).max(128),
  /// §21: упорядоченные formula_id. Не передан — берётся allowlist релиза 1.0,
  /// но выбранные id/версии всё равно сохраняются в прогоне.
  requested_calculations: z.array(z.string().trim().min(1).max(64)).min(1).max(16).optional(),
  parameters: z.object({
    annual_nominal_rate_percent: z.union([z.number(), z.string()]),
    term_months: z.number().int(),
    payment_frequency: z.literal('MONTHLY').default('MONTHLY'),
    /// §21 parameters несут провенанс: откуда взяты ставка и срок.
    source: z.string().trim().min(1).max(64).default('OPERATOR_INPUT'),
    channel: z.string().trim().min(1).max(64).default('CASA_PRO_UI'),
  }).strict(),
}).strict();

/** Статус поля M05 → статус входа M06 (§19). CONFLICT блокирует, а не «почти ок». */
function profileStatusToInputStatus(status: string | null | undefined): InputStatus {
  switch (status) {
    // Поля профиля несут VERIFIED, агрегаты (aggregateMoney) — уже CONFIRMED.
    case 'VERIFIED': return 'CONFIRMED';
    case 'CONFIRMED': return 'CONFIRMED';
    case 'DECLARED': return 'DECLARED';
    case 'CONFLICT': return 'CONFLICT';
    case 'UNKNOWN': return 'UNKNOWN';
    default: return 'MISSING';
  }
}

/** Достаёт вход M06 из payload снапшота M05, не «чиня» отсутствующее нулём. */
function amountFromSnapshot(
  node: unknown,
  valueKey: string,
): { amount: string | null; status: InputStatus } {
  if (!node || typeof node !== 'object') return { amount: null, status: 'MISSING' };
  const n = node as Record<string, unknown>;
  const raw = n[valueKey];
  const amount = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null;
  const status = profileStatusToInputStatus(n.status as string | undefined);
  if (amount === null && status !== 'UNKNOWN' && status !== 'CONFLICT') {
    return { amount: null, status: 'MISSING' };
  }
  return { amount, status };
}

/**
 * Полный execution context прогона (§21). Отдаётся целиком: аудит должен
 * видеть, на чём именно считали, не заглядывая в БД руками.
 */
function calcRunResponse(run: any) {
  return {
    calculation_run_id: run.id,
    case_id: run.caseId,
    tenant_id: run.tenantId,
    tenant_scope_kind: run.tenantScopeKind,
    actor_id: run.actorId,
    status: run.status,
    engine_version: run.engineVersion,
    decimal_context_version: run.decimalContextVersion,
    formula_registry_version: run.formulaRegistryVersion,
    client_profile_snapshot: {
      snapshot_id: run.clientProfileSnapshotId,
      snapshot_hash: run.clientProfileSnapshotHash,
    },
    participant_scope: run.participantScopeJson,
    selected_upstream_refs: run.selectedUpstreamRefsJson,
    requested_calculations: run.requestedCalculationsJson,
    parameters: run.parametersJson,
    inputs: run.inputsJson,
    input_hash: run.inputHash,
    results: run.resultsJson,
    blockers: run.blockersJson,
    idempotency_key: run.idempotencyKey,
    request_hash: run.requestHash,
    calculated_at: run.calculatedAt,
    created_at: run.createdAt,
    ...(run.snapshot === undefined
      ? {}
      : { snapshot: run.snapshot ? calcSnapshotResponse(null, run.snapshot) : null }),
  };
}

function calcSnapshotResponse(run: any, snap: any) {
  return {
    id: snap.id,
    run_id: snap.runId,
    case_id: snap.caseId,
    tenant_id: snap.tenantId,
    tenant_scope_kind: snap.tenantScopeKind,
    schema_version: snap.schemaVersion,
    engine_version: snap.engineVersion,
    decimal_context_version: snap.decimalContextVersion,
    formula_registry_version: snap.formulaRegistryVersion,
    canonicalization_version: snap.canonicalizationVersion,
    client_profile_snapshot: {
      snapshot_id: snap.clientProfileSnapshotId,
      snapshot_hash: snap.clientProfileSnapshotHash,
    },
    input_hash: snap.inputHash,
    output_hash: snap.outputHash,
    replay_hash: snap.replayHash,
    status: snap.status,
    results: snap.resultsJson,
    replay_payload: snap.replayPayloadJson,
    calculated_at: snap.calculatedAt,
    created_at: snap.createdAt,
    ...(run ? { run: { id: run.id, status: run.status, created_at: run.createdAt } } : {}),
  };
}

// POST /api/v2/cases/{caseId}/calculation-runs  (API-M06-001)
mortgageCasesRouter.post('/:caseId/calculation-runs', async (req: Request, res: Response): Promise<void> => {
  const key = idempotencyKey(req);
  if (!key) {
    apiError(res, 400, 'idempotency_key_required', 'Требуется корректный заголовок Idempotency-Key');
    return;
  }
  const parsed = calcRunSchema.safeParse(req.body);
  if (!parsed.success) {
    apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
    return;
  }

  const actorId = req.user!.userId;
  const operation = 'mortgage_calculation.run';
  const requestHash = mortgageRequestHash({ caseId: req.params.caseId, body: parsed.data });
  const uniqueWhere = { actorId_operation_key: { actorId, operation, key } };

  try {
    const result = await runSerializable(async (tx) => {
      const existing = await tx.mortgageIdempotencyRecord.findUnique({ where: uniqueWhere });
      if (existing && existing.expiresAt > new Date()) {
        if (existing.requestHash !== requestHash) return { kind: 'conflict' as const };
        if (existing.responseStatus && existing.responseBody) {
          return { kind: 'replay' as const, status: existing.responseStatus, body: existing.responseBody };
        }
        return { kind: 'in_progress' as const };
      }
      if (existing) await tx.mortgageIdempotencyRecord.delete({ where: uniqueWhere });

      const current = await tx.mortgageCase.findUnique({
        where: { id: req.params.caseId },
        include: { parties: true },
      });
      if (!current || !canAccessMortgageCase(current, req.user!)) return { kind: 'not_found' as const };

      // §21: единственный источник данных профиля — опубликованный снапшот M05.
      const cps = await tx.mortgageClientProfileSnapshot.findUnique({
        where: { id: parsed.data.client_profile_snapshot_id },
      });
      if (!cps || cps.caseId !== current.id) return { kind: 'snapshot_not_found' as const };

      // §21 requested_calculations: неизвестная/отключённая формула отвергается,
      // а не заменяется молча на «похожую».
      let requestedCalculations;
      try {
        requestedCalculations = resolveRequestedCalculations(parsed.data.requested_calculations);
      } catch (error) {
        if (error instanceof FormulaNotAllowedError) {
          return { kind: 'formula_rejected' as const, code: error.code, message: error.message };
        }
        throw error;
      }

      const payload = (cps.payloadJson ?? {}) as Record<string, unknown>;
      const targetPrice = amountFromSnapshot(payload.purchase_goal, 'target_price_max');
      const availableNow = amountFromSnapshot(payload.available_now_total, 'value');
      const upstream = (payload.selected_upstream_refs ?? {}) as Record<string, string | null>;

      const runContext: CalculationRunContext = {
        caseId: current.id,
        clientProfileSnapshot: { snapshotId: cps.id, snapshotHash: cps.contentHash },
        selectedUpstreamRefs: {
          iin_check_batch_id: upstream.iin_check_batch_id ?? null,
          credit_history_snapshot_id: upstream.credit_history_snapshot_id ?? null,
          pension_snapshot_id: upstream.pension_snapshot_id ?? null,
        },
        targetPrice,
        availableNowDownPayment: availableNow,
        parameters: {
          annualNominalRatePercent: parsed.data.parameters.annual_nominal_rate_percent,
          termMonths: parsed.data.parameters.term_months,
          paymentFrequency: parsed.data.parameters.payment_frequency,
        },
      };
      const calc = runCalculation(runContext);

      // §21 participant_scope: точные id/роли/included_in_analysis. Основной
      // заёмщик — сам кейс; добавленные участники включаются в анализ только
      // явным решением (M01: супруг ≠ созаёмщик), поэтому флаг читается, а не
      // предполагается.
      const participantScope = [...current.parties]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((party) => ({
          participant_id: party.id,
          client_id: party.clientId,
          role: party.role,
          included_in_analysis: party.includedInAnalysis,
        }));

      const parameters = {
        annual_nominal_rate_percent: String(parsed.data.parameters.annual_nominal_rate_percent),
        term_months: parsed.data.parameters.term_months,
        payment_frequency: parsed.data.parameters.payment_frequency,
        source: parsed.data.parameters.source,
        channel: parsed.data.parameters.channel,
        actor_id: actorId,
      };

      const run = await tx.mortgageCalculationRun.create({
        data: {
          caseId: current.id,
          // Область доступа M01 = владелец кейса. Отдельной сущности tenant в
          // модели нет; вид области пишем явно, чтобы аудит видел, что именно
          // проверялось, а не догадывался по дефолту столбца.
          tenantId: current.ownerId,
          tenantScopeKind: 'CASE_OWNER',
          actorId,
          engineVersion: M06_ENGINE_VERSION,
          decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
          formulaRegistryVersion: M06_FORMULA_REGISTRY_VERSION,
          clientProfileSnapshotId: cps.id,
          clientProfileSnapshotHash: cps.contentHash,
          participantScopeJson: participantScope as unknown as Prisma.InputJsonValue,
          selectedUpstreamRefsJson: runContext.selectedUpstreamRefs as Prisma.InputJsonValue,
          requestedCalculationsJson: requestedCalculations as unknown as Prisma.InputJsonValue,
          parametersJson: parameters as Prisma.InputJsonValue,
          inputsJson: calc.canonicalInputs as Prisma.InputJsonValue,
          inputHash: calc.inputHash,
          resultsJson: calc.results as unknown as Prisma.InputJsonValue,
          blockersJson: calc.results.blockers as unknown as Prisma.InputJsonValue,
          idempotencyKey: key,
          requestHash,
          status: calc.results.status,
        },
      });
      const snapshot = await tx.mortgageCalculationSnapshot.create({
        data: {
          caseId: current.id,
          tenantId: current.ownerId,
          tenantScopeKind: 'CASE_OWNER',
          runId: run.id,
          schemaVersion: M06_SCHEMA_VERSION,
          engineVersion: M06_ENGINE_VERSION,
          decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
          formulaRegistryVersion: M06_FORMULA_REGISTRY_VERSION,
          canonicalizationVersion: calc.canonicalizationVersion,
          inputHash: calc.inputHash,
          outputHash: calc.outputHash,
          replayHash: calc.replayHash,
          clientProfileSnapshotId: cps.id,
          clientProfileSnapshotHash: cps.contentHash,
          replayPayloadJson: calc.replayPayload as Prisma.InputJsonValue,
          resultsJson: calc.results as unknown as Prisma.InputJsonValue,
          status: calc.results.status,
        },
      });

      await tx.mortgageAuditEvent.create({
        data: {
          caseId: current.id,
          actorId,
          action: 'mortgage_calculation.run',
          objectType: 'MortgageCalculationSnapshot',
          objectId: snapshot.id,
          purpose: 'mortgage_prescore',
          result: 'SUCCESS',
          reasonCode: calc.results.status,
          metadataHash: calc.outputHash,
        },
      });

      const body = {
        data: {
          ...calcSnapshotResponse(run, snapshot),
          // §21: контекст исполнения предъявляется вместе с результатом.
          calculation_run: calcRunResponse(run),
        },
      };
      await tx.mortgageIdempotencyRecord.create({
        data: {
          actorId, operation, key, requestHash,
          responseStatus: 201, responseBody: body as Prisma.InputJsonValue,
          resourceId: snapshot.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { kind: 'created' as const, status: 201, body };
    });

    if (result.kind === 'conflict') { apiError(res, 409, 'idempotency_conflict', 'Idempotency-Key уже использован с другим запросом'); return; }
    if (result.kind === 'in_progress') { apiError(res, 409, 'request_in_progress', 'Запрос с этим Idempotency-Key ещё выполняется'); return; }
    if (result.kind === 'not_found') { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
    if (result.kind === 'formula_rejected') {
      apiError(res, 422, result.code.toLowerCase(), result.message);
      return;
    }
    if (result.kind === 'snapshot_not_found') {
      apiError(res, 409, 'client_profile_snapshot_required',
        'Снапшот профиля M05 не найден для этого кейса: расчёт без опубликованного профиля невозможен');
      return;
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : (error as { code?: string })?.code;
    if (code === 'P2002') {
      const winner = await prisma.mortgageIdempotencyRecord.findUnique({ where: uniqueWhere });
      if (winner && winner.expiresAt > new Date() && winner.requestHash === requestHash && winner.responseStatus && winner.responseBody) {
        res.status(winner.responseStatus).json(winner.responseBody); return;
      }
    }
    console.error('Calculation run failed', { actorId, code: code ?? 'unknown' });
    apiError(res, 500, 'internal_error', 'Не удалось выполнить расчёт');
  }
});

// GET /api/v2/cases/{caseId}/calculation-runs/{runId}  (API-M06-002)
mortgageCasesRouter.get('/:caseId/calculation-runs/:runId', async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await prisma.mortgageCalculationRun.findUnique({
      where: { id: req.params.runId },
      include: { mortgageCase: true, snapshot: true },
    });
    if (!run || run.caseId !== req.params.caseId || !canAccessMortgageCase(run.mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Расчётный прогон не найден'); return;
    }
    res.json({ data: calcRunResponse(run) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить прогон');
  }
});

// GET /api/v2/cases/{caseId}/calculation-snapshots/{snapshotId}  (API-M06-003)
mortgageCasesRouter.get('/:caseId/calculation-snapshots/:snapshotId', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await prisma.mortgageCalculationSnapshot.findUnique({
      where: { id: req.params.snapshotId },
      include: { mortgageCase: true },
    });
    if (!snap || snap.caseId !== req.params.caseId || !canAccessMortgageCase(snap.mortgageCase, req.user!)) {
      apiError(res, 404, 'not_found', 'Снапшот расчёта не найден'); return;
    }
    res.json({ data: calcSnapshotResponse(null, snap) });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить снапшот');
  }
});

// =========================================================================
// M05 Client Profile — canonical эндпоинты (API-M05-001,004..008,010).
// Денежные поля несут статус; UNKNOWN ≠ 0; available_now_total → вход M06.
// =========================================================================

const FIELD_STATUS = ['DECLARED', 'VERIFIED', 'UNKNOWN', 'CONFLICT'] as const;
const moneySubSchema = z.object({
  kind: z.string().min(1).max(64),
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
  currency: z.string().length(3).default('KZT'),
  status: z.enum(FIELD_STATUS).default('DECLARED'),
  party_id: z.string().max(128).optional(),
}).strict();
const employmentSchema = z.object({
  employer_name: z.string().min(1).max(256),
  employment_kind: z.string().min(1).max(64),
  status: z.enum(FIELD_STATUS).default('DECLARED'),
  party_id: z.string().max(128).optional(),
}).strict();

async function loadCaseForProfile(caseId: string, user: any) {
  const current = await prisma.mortgageCase.findUnique({ where: { id: caseId } });
  if (!current || !canAccessMortgageCase(current, user)) return null;
  return current;
}

async function ensureProfileId(caseId: string): Promise<string> {
  const existing = await prisma.mortgageClientProfile.findUnique({ where: { caseId } });
  if (existing) return existing.id;
  const created = await prisma.mortgageClientProfile.upsert({
    where: { caseId },
    update: {},
    create: { caseId },
  });
  return created.id;
}

function moneySourceRow(r: { amount?: any; monthlyAmount?: any; value?: any; status: string }): MoneySource {
  const amount = r.amount ?? r.monthlyAmount ?? r.value ?? null;
  return { amount, status: r.status as any };
}

/** purchase_goal в ответе/снапшоте: сумма строкой Decimal(20,2) либо null. */
function purchaseGoalNode(goal: { targetPriceMax: any; currency: string; status: string } | null) {
  if (!goal || goal.targetPriceMax === null || goal.targetPriceMax === undefined) {
    return { target_price_max: null, currency: 'KZT', status: goal?.status ?? 'UNKNOWN' };
  }
  return {
    target_price_max: new Prisma.Decimal(goal.targetPriceMax).toFixed(2),
    currency: goal.currency,
    status: goal.status,
  };
}

/** API-M05-002: цель покупки — единственный источник target_price для M06. */
const patchProfileSchema = z.object({
  purchase_goal: z.object({
    target_price_max: z.union([z.number(), z.string(), z.null()]),
    currency: z.string().length(3).default('KZT'),
    status: z.enum(FIELD_STATUS).default('DECLARED'),
    property_kind: z.string().max(64).nullable().optional(),
    region_code: z.string().max(32).nullable().optional(),
  }).strict(),
}).strict();

// GET /api/v2/cases/{caseId}/client-profile (API-M05-001) — авто-создание + агрегаты
mortgageCasesRouter.get('/:caseId/client-profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await loadCaseForProfile(req.params.caseId, req.user!);
    if (!current) { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
    await ensureProfileId(current.id);
    const profile = await prisma.mortgageClientProfile.findUnique({
      where: { caseId: current.id },
      include: {
        purchaseGoal: true, employments: true, incomeSources: true, assets: true,
        downPaymentSources: true, nonCreditCommitments: true,
      },
    });
    if (!profile) { apiError(res, 500, 'internal_error', 'Профиль не создан'); return; }

    const availableNow = aggregateMoney(profile.downPaymentSources.map(moneySourceRow));
    const monthlyIncome = aggregateMoney(profile.incomeSources.map(moneySourceRow));
    const monthlyCommitments = aggregateMoney(profile.nonCreditCommitments.map(moneySourceRow));
    const latestSnapshot = await prisma.mortgageClientProfileSnapshot.findFirst({
      where: { caseId: current.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: {
      id: profile.id, case_id: profile.caseId, version: profile.version,
      purchase_goal: purchaseGoalNode(profile.purchaseGoal),
      latest_snapshot: latestSnapshot
        ? { id: latestSnapshot.id, content_hash: latestSnapshot.contentHash, created_at: latestSnapshot.createdAt }
        : null,
      down_payment_sources: profile.downPaymentSources,
      income_sources: profile.incomeSources,
      assets: profile.assets,
      employments: profile.employments,
      non_credit_commitments: profile.nonCreditCommitments,
      aggregates: {
        available_now_total: availableNow, // вход M06 CALC-F-001
        monthly_income_total: monthlyIncome,
        monthly_commitments_total: monthlyCommitments,
      },
    } });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось получить профиль');
  }
});

// PATCH /api/v2/cases/{caseId}/client-profile (API-M05-002)
mortgageCasesRouter.patch('/:caseId/client-profile', async (req: Request, res: Response): Promise<void> => {
  const parsed = patchProfileSchema.safeParse(req.body);
  if (!parsed.success) { apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten()); return; }
  try {
    const current = await loadCaseForProfile(req.params.caseId, req.user!);
    if (!current) { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
    const profileId = await ensureProfileId(current.id);
    const g = parsed.data.purchase_goal;
    // Сумма null означает «цель не задана» и обязана обнулять статус в UNKNOWN,
    // иначе профиль отчитается DECLARED без единой цифры.
    const status = g.target_price_max === null ? 'UNKNOWN' : g.status;
    const data = {
      targetPriceMax: g.target_price_max === null ? null : new Prisma.Decimal(g.target_price_max),
      currency: g.currency,
      status,
      propertyKind: g.property_kind ?? null,
      regionCode: g.region_code ?? null,
    };
    const goal = await prisma.mortgagePurchaseGoal.upsert({
      where: { profileId },
      update: data,
      create: { profileId, ...data },
    });
    await prisma.mortgageClientProfile.update({
      where: { id: profileId },
      data: { version: { increment: 1 } },
    });
    await prisma.mortgageAuditEvent.create({ data: {
      caseId: current.id, actorId: req.user!.userId, action: 'mortgage_profile.purchase_goal_set',
      objectType: 'MortgagePurchaseGoal', objectId: goal.id, purpose: 'mortgage_prescore',
      result: 'SUCCESS', reasonCode: status,
    } });
    res.json({ data: { purchase_goal: purchaseGoalNode(goal) } });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось обновить профиль');
  }
});

// Общий обработчик создания денежного под-ресурса профиля.
function makeMoneySubHandler(
  model: 'mortgageDownPaymentSource' | 'mortgageIncomeSource' | 'mortgageAsset' | 'mortgageNonCreditCommitment',
  amountField: 'amount' | 'monthlyAmount' | 'value',
  action: string,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = moneySubSchema.safeParse(req.body);
    if (!parsed.success) { apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten()); return; }
    try {
      const current = await loadCaseForProfile(req.params.caseId, req.user!);
      if (!current) { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
      const profileId = await ensureProfileId(current.id);
      const data: any = {
        profileId, partyId: parsed.data.party_id, kind: parsed.data.kind,
        currency: parsed.data.currency, status: parsed.data.status,
        [amountField]: parsed.data.amount ?? null,
      };
      const row = await (prisma as any)[model].create({ data });
      await prisma.mortgageAuditEvent.create({ data: {
        caseId: current.id, actorId: req.user!.userId, action,
        objectType: model, objectId: row.id, purpose: 'mortgage_prescore',
        result: 'SUCCESS', reasonCode: parsed.data.status,
      } });
      res.status(201).json({ data: row });
    } catch {
      apiError(res, 500, 'internal_error', 'Не удалось создать запись профиля');
    }
  };
}

// POST под-ресурсы (API-M05-004..008)
mortgageCasesRouter.post('/:caseId/down-payment-sources', makeMoneySubHandler('mortgageDownPaymentSource', 'amount', 'mortgage_profile.down_payment_added'));
mortgageCasesRouter.post('/:caseId/income-sources', makeMoneySubHandler('mortgageIncomeSource', 'monthlyAmount', 'mortgage_profile.income_added'));
mortgageCasesRouter.post('/:caseId/assets', makeMoneySubHandler('mortgageAsset', 'value', 'mortgage_profile.asset_added'));
mortgageCasesRouter.post('/:caseId/non-credit-commitments', makeMoneySubHandler('mortgageNonCreditCommitment', 'monthlyAmount', 'mortgage_profile.commitment_added'));

// POST /:caseId/employments (API-M05-004)
mortgageCasesRouter.post('/:caseId/employments', async (req: Request, res: Response): Promise<void> => {
  const parsed = employmentSchema.safeParse(req.body);
  if (!parsed.success) { apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten()); return; }
  try {
    const current = await loadCaseForProfile(req.params.caseId, req.user!);
    if (!current) { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
    const profileId = await ensureProfileId(current.id);
    const row = await prisma.mortgageEmployment.create({ data: {
      profileId, partyId: parsed.data.party_id, employerName: parsed.data.employer_name,
      employmentKind: parsed.data.employment_kind, status: parsed.data.status,
    } });
    res.status(201).json({ data: row });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось создать запись о занятости');
  }
});

// POST /:caseId/client-profile/publish-snapshot (API-M05-010) — иммутабельный снапшот
mortgageCasesRouter.post('/:caseId/client-profile/publish-snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await loadCaseForProfile(req.params.caseId, req.user!);
    if (!current) { apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return; }
    const profile = await prisma.mortgageClientProfile.findUnique({
      where: { caseId: current.id },
      include: {
        purchaseGoal: true, employments: true, incomeSources: true,
        assets: true, downPaymentSources: true, nonCreditCommitments: true,
      },
    });
    if (!profile) { apiError(res, 409, 'profile_empty', 'Профиль ещё не создан'); return; }

    const payload = {
      case_id: profile.caseId, version: profile.version,
      // purchase_goal.target_price_max — вход CALC-F-001. Цель не задана →
      // status MISSING, а не ноль: M06 обязан заблокироваться, а не считать.
      purchase_goal: purchaseGoalNode(profile.purchaseGoal),
      available_now_total: aggregateMoney(profile.downPaymentSources.map(moneySourceRow)),
      monthly_income_total: aggregateMoney(profile.incomeSources.map(moneySourceRow)),
      monthly_commitments_total: aggregateMoney(profile.nonCreditCommitments.map(moneySourceRow)),
      // §21: ссылки M02/M03/M04 в том виде, как их несёт M05. Пока канонические
      // M02/M03/M04 не реализованы, честное значение — null, не выдуманный id.
      selected_upstream_refs: {
        iin_check_batch_id: null,
        credit_history_snapshot_id: null,
        pension_snapshot_id: null,
      },
      counts: {
        down_payment: profile.downPaymentSources.length, income: profile.incomeSources.length,
        assets: profile.assets.length, employments: profile.employments.length,
        commitments: profile.nonCreditCommitments.length,
      },
    };
    const contentHash = profileContentHash(payload);
    const snapshot = await prisma.mortgageClientProfileSnapshot.create({ data: {
      caseId: profile.caseId, profileId: profile.id, version: profile.version,
      payloadJson: payload as any, contentHash,
    } });
    await prisma.mortgageClientProfile.update({ where: { id: profile.id }, data: { latestSnapshotId: snapshot.id } });
    await prisma.mortgageAuditEvent.create({ data: {
      caseId: profile.caseId, actorId: req.user!.userId, action: 'mortgage_profile.snapshot_published',
      objectType: 'MortgageClientProfileSnapshot', objectId: snapshot.id, purpose: 'mortgage_prescore',
      result: 'SUCCESS', metadataHash: contentHash,
    } });
    res.status(201).json({ data: { id: snapshot.id, case_id: snapshot.caseId, version: snapshot.version, content_hash: contentHash, payload, created_at: snapshot.createdAt } });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось опубликовать снапшот профиля');
  }
});

// =========================================================================
// M01 consent-preflight (API-M01-007): allow/deny операции по согласиям всех
// участников кейса + причины отказа. Read-only решение + аудит (без PII).
// =========================================================================

const preflightSchema = z.object({
  operation: z.string().min(1).max(128),
}).strict();

mortgageCasesRouter.post('/:caseId/consent-preflight', async (req: Request, res: Response): Promise<void> => {
  const parsed = preflightSchema.safeParse(req.body);
  if (!parsed.success) { apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten()); return; }
  try {
    const current = await prisma.mortgageCase.findUnique({
      where: { id: req.params.caseId },
      include: { parties: { include: { consentRevision: true } } },
    });
    if (!current || !canAccessMortgageCase(current, req.user!)) {
      apiError(res, 404, 'not_found', 'Ипотечный кейс не найден'); return;
    }

    const operation = parsed.data.operation;
    const participants = current.parties.map((party) => {
      if (!party.consentRevision) return { client_id: party.clientId, role: party.role, allowed: false, reason: 'NO_CONSENT' };
      const allowed = isActiveMortgageConsent(party.consentRevision, operation);
      return { client_id: party.clientId, role: party.role, allowed, reason: allowed ? null : 'CONSENT_INACTIVE' };
    });
    const allowed = participants.length > 0 && participants.every((p) => p.allowed);

    await prisma.mortgageAuditEvent.create({ data: {
      caseId: current.id, actorId: req.user!.userId, action: 'mortgage_consent.preflight',
      objectType: 'MortgageCase', objectId: current.id, purpose: 'mortgage_prescore',
      result: allowed ? 'ALLOW' : 'DENY', reasonCode: operation,
    } });

    res.json({ data: { allowed, operation, participants } });
  } catch {
    apiError(res, 500, 'internal_error', 'Не удалось выполнить проверку согласий');
  }
});

// =========================================================================
// M01 — выдача согласия участнику (включая PRIMARY).
//
// ЗАЧЕМ: до этого ни одна строка кода не создавала ConsentRevision, а у
// основного заёмщика согласие негде было хранить (партия PRIMARY создавалась
// без consentRevisionId и никогда не обновлялась). Из-за этого проверка по
// ИИН всегда упиралась в BLOCKED_CONSENT, а перевод статуса кейса — в
// CONSENT_REQUIRED: сквозной путь был непроходим.
//
// Спека: цель — только из утверждённого реестра (§8); evidence обязателен для
// ACTIVE (§7); действие фиксируется в append-only аудите.
// =========================================================================

const grantConsentSchema = z.object({
  purpose_code: z.string().trim().min(1).max(128),
  allowed_operations: z.array(z.string().trim().min(1).max(128)).min(1).max(16),
  legal_text_version: z.string().trim().min(1).max(64),
  legal_text_hash: z.string().trim().length(64).optional(),
  // Подтверждение обязательно: ACTIVE без доказательства спека запрещает.
  evidence_type: z.string().trim().min(1).max(64),
  evidence_ref: z.string().trim().min(1).max(256),
  source_channel: z.string().trim().max(64).optional(),
  data_categories: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  expires_at: z.string().datetime().optional(),
}).strict();

mortgageCasesRouter.post(
  '/:caseId/participants/:partyId/consent',
  async (req: Request, res: Response): Promise<void> => {
    const parsed = grantConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      apiError(res, 400, 'validation_error', 'Ошибка валидации запроса', parsed.error.flatten());
      return;
    }
    const { purpose_code: purposeCode, allowed_operations: operations } = parsed.data;

    // §8: неизвестная или отключённая цель не открывает действий.
    const purpose = findPurpose(purposeCode);
    if (!purpose) {
      apiError(res, 422, 'purpose_unknown', 'Цель обработки отсутствует в утверждённом реестре');
      return;
    }
    if (purpose.state !== 'APPROVED') {
      apiError(res, 422, 'purpose_disabled',
        `Цель обработки отключена: ${purpose.blockedBy ?? 'ожидает решения'}`);
      return;
    }
    const unknownOps = operations.filter((op) => !isKnownOperation(op));
    if (unknownOps.length > 0) {
      apiError(res, 422, 'operation_unknown', `Неизвестные действия: ${unknownOps.join(', ')}`);
      return;
    }

    try {
      const result = await runSerializable(async (tx) => {
        const current = await tx.mortgageCase.findUnique({ where: { id: req.params.caseId } });
        if (!current || !canAccessMortgageCase(current, req.user!)) return { kind: 'not_found' as const };

        const party = await tx.mortgageCaseParty.findUnique({ where: { id: req.params.partyId } });
        if (!party || party.caseId !== current.id) return { kind: 'not_found' as const };

        // Контейнер согласия на клиента — один; ревизии копятся внутри него.
        const container = await tx.clientConsent.findFirst({ where: { clientId: party.clientId } })
          ?? await tx.clientConsent.create({ data: { clientId: party.clientId } });

        const revision = await tx.consentRevision.create({
          data: {
            consentId: container.id,
            purposeCode,
            purposeDescription: purpose.title,
            allowedOperations: operations,
            dataCategories: parsed.data.data_categories ?? [],
            sourceChannel: parsed.data.source_channel,
            legalTextVersion: parsed.data.legal_text_version,
            legalTextHash: parsed.data.legal_text_hash,
            evidenceType: parsed.data.evidence_type,
            evidenceRef: parsed.data.evidence_ref,
            status: 'ACTIVE',
            grantedAt: new Date(),
            expiresAt: parsed.data.expires_at ? new Date(parsed.data.expires_at) : null,
            supersedesId: party.consentRevisionId,
          },
        });

        // Привязка к участнику — то, чего не хватало для PRIMARY.
        await tx.mortgageCaseParty.update({
          where: { id: party.id },
          data: { consentRevisionId: revision.id },
        });

        await tx.mortgageAuditEvent.create({
          data: {
            caseId: current.id, actorId: req.user!.userId,
            action: 'consent.granted', objectType: 'ConsentRevision', objectId: revision.id,
            purpose: purposeCode, result: 'SUCCESS',
            metadataHash: mortgageRequestHash({
              purposeCode, operations, legalTextVersion: parsed.data.legal_text_version,
            }),
          },
        });

        return { kind: 'granted' as const, revision, partyId: party.id };
      });

      if (result.kind === 'not_found') {
        apiError(res, 404, 'not_found', 'Кейс или участник не найден');
        return;
      }
      res.status(201).json({ data: {
        consent_revision_id: result.revision.id,
        participant_id: result.partyId,
        purpose_code: result.revision.purposeCode,
        allowed_operations: result.revision.allowedOperations,
        status: result.revision.status,
        granted_at: result.revision.grantedAt,
        expires_at: result.revision.expiresAt,
        supersedes_id: result.revision.supersedesId,
      } });
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
      console.error('Grant consent failed', { code: code ?? 'unknown' });
      apiError(res, 500, 'internal_error', 'Не удалось выдать согласие');
    }
  },
);

export default mortgageCasesRouter;