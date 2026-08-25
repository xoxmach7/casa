import crypto from 'crypto';
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
  M06_ENGINE_VERSION,
  M06_DECIMAL_CONTEXT_VERSION,
} from '../lib/mortgage-workspace/mortgage-calc.service';
import type { StatusedMoney, InputStatus } from '../lib/mortgage-workspace/m06-calc';

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
        data: { caseId: mortgageCase.id, clientId: client.id, role: 'PRIMARY' },
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

mortgageCasesRouter.post('/:id/parties', async (req: Request, res: Response): Promise<void> => {
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

const INPUT_STATUS_VALUES = [
  'CONFIRMED', 'DECLARED', 'EVIDENCE_REQUESTED', 'MISSING', 'UNKNOWN', 'STALE', 'CONFLICT',
] as const;

const calcMoney = z.union([z.number(), z.string(), z.null()]).optional();
const calcRunSchema = z.object({
  target_price_max: calcMoney,
  available_now_total: calcMoney,
  annual_nominal_rate_percent: calcMoney,
  term_months: z.number().int().nullable().optional(),
  input_statuses: z.object({
    target_price_max: z.enum(INPUT_STATUS_VALUES).optional(),
    available_now_total: z.enum(INPUT_STATUS_VALUES).optional(),
    annual_nominal_rate_percent: z.enum(INPUT_STATUS_VALUES).optional(),
  }).strict().optional(),
}).strict();

function toStatused(value: number | string | null | undefined, status?: InputStatus): StatusedMoney {
  if (status) return { value: value ?? undefined, status };
  return value ?? undefined;
}

function calcSnapshotResponse(run: any, snap: any) {
  return {
    id: snap.id,
    run_id: snap.runId,
    case_id: snap.caseId,
    engine_version: snap.engineVersion,
    decimal_context_version: snap.decimalContextVersion,
    input_hash: snap.inputHash,
    output_hash: snap.outputHash,
    status: snap.status,
    results: snap.resultsJson,
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

      const current = await tx.mortgageCase.findUnique({ where: { id: req.params.caseId } });
      if (!current || !canAccessMortgageCase(current, req.user!)) return { kind: 'not_found' as const };

      const s = parsed.data.input_statuses ?? {};
      const calc = runCalculation({
        targetPriceMax: toStatused(parsed.data.target_price_max, s.target_price_max),
        availableNowTotal: toStatused(parsed.data.available_now_total, s.available_now_total),
        annualNominalRatePercent: toStatused(parsed.data.annual_nominal_rate_percent, s.annual_nominal_rate_percent),
        termMonths: parsed.data.term_months ?? null,
      });

      const run = await tx.mortgageCalculationRun.create({
        data: {
          caseId: current.id,
          actorId,
          engineVersion: M06_ENGINE_VERSION,
          decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
          inputsJson: parsed.data as Prisma.InputJsonValue,
          inputHash: calc.inputHash,
          status: calc.results.status,
        },
      });
      const snapshot = await tx.mortgageCalculationSnapshot.create({
        data: {
          caseId: current.id,
          runId: run.id,
          engineVersion: M06_ENGINE_VERSION,
          decimalContextVersion: M06_DECIMAL_CONTEXT_VERSION,
          inputHash: calc.inputHash,
          outputHash: calc.outputHash,
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

      const body = { data: calcSnapshotResponse(run, snapshot) };
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
    res.json({ data: {
      id: run.id, case_id: run.caseId, status: run.status,
      engine_version: run.engineVersion, input_hash: run.inputHash,
      inputs: run.inputsJson, created_at: run.createdAt,
      snapshot: run.snapshot ? calcSnapshotResponse(null, run.snapshot) : null,
    } });
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

export default mortgageCasesRouter;