// =========================================
// VALUATIONS ROUTES (CASA Developer Handoff v2.0 — Valuation module)
// Внутренний CASA Pro пайплайн оценки вторичного объекта: submitted →
// preliminary_calculation → preliminary_ready | manual_review_required →
// comparable_collection → confirmed → accepted | accepted_with_price_condition
// | rejected. Не путать с публичным мгновенным расчётом в
// public-valuation.routes.ts — тот считает автоматически без человека,
// что прямо запрещено спекой для Release 1 (см. gap-audit, раздел «Открытые
// вопросы»); эти два эндпоинта сейчас сознательно сосуществуют до
// продуктового решения по /otsenka.
//
// Роли: до введения выделенных ролей Coordinator/Operator/Analyst из спеки
// (нет в текущем UserRole) все действия здесь ограничены ADMIN.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../lib/audit-log.service';
import {
  computePreliminaryRange,
  canConfirmValuation,
  normalizeSourceRef,
} from '../lib/valuation-pipeline.service';

export const valuationsRouter = Router();
valuationsRouter.use(authenticate, requireRole('ADMIN'));

// Пилот — только Алматы (см. 06_CASA_Release_QA_Plan config key pilot.city_id);
// пока нет справочника городов, используем константу.
const PILOT_CITY_ID = 'almaty';

function actorMeta(req: Request) {
  return { actorUserId: req.user?.userId, actorRole: req.user?.role };
}

// POST /api/valuations — создать заявку на оценку объекта
valuationsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = z.object({ propertyId: z.string().min(1) }).parse(req.body);

    const property = await prisma.crmProperty.findUnique({ where: { id: propertyId } });
    if (!property) {
      res.status(404).json({ error: { code: 'not_found', message: 'Объект не найден' } });
      return;
    }

    const valuation = await prisma.valuation.create({
      data: { propertyId, status: 'SUBMITTED', currentVersion: 0 },
    });

    await recordAuditLog({
      ...actorMeta(req),
      action: 'CREATE',
      entityType: 'Valuation',
      entityId: valuation.id,
      newValues: { propertyId, status: 'SUBMITTED' },
    });

    res.status(201).json({ data: valuation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Create valuation error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка создания оценки' } });
  }
});

// POST /api/valuations/:id/calculate-preliminary
valuationsRouter.post('/:id/calculate-preliminary', async (req: Request, res: Response): Promise<void> => {
  try {
    const valuation = await prisma.valuation.findUnique({
      where: { id: req.params.id },
      include: { property: true },
    });
    if (!valuation) {
      res.status(404).json({ error: { code: 'not_found', message: 'Оценка не найдена' } });
      return;
    }

    const { property } = valuation;
    const nextVersionNumber = valuation.currentVersion + 1;

    // Приоритет: прямой аналог того же ЖК → fallback на район (residentialComplexId=null).
    const reference =
      (await prisma.marketReference.findFirst({
        where: {
          cityId: PILOT_CITY_ID,
          residentialComplexId: property.residentialComplex,
          rooms: property.rooms,
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        },
        orderBy: { sourceDate: 'desc' },
      })) ??
      (await prisma.marketReference.findFirst({
        where: {
          cityId: PILOT_CITY_ID,
          districtId: property.district,
          residentialComplexId: null,
          isActive: true,
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        },
        orderBy: { sourceDate: 'desc' },
      }));

    let versionData: any = {
      valuationId: valuation.id,
      versionNumber: nextVersionNumber,
    };
    let newStatus: 'PRELIMINARY_READY' | 'MANUAL_REVIEW_REQUIRED';

    if (!reference) {
      // Hard guard из спеки: без валидного market reference цена не
      // придумывается — заявка уходит на ручной разбор.
      newStatus = 'MANUAL_REVIEW_REQUIRED';
    } else {
      const range = computePreliminaryRange(
        Number(property.area),
        Number(reference.basePricePerM2Low),
        Number(reference.basePricePerM2High)
      );
      versionData = {
        ...versionData,
        preliminaryLow: range.preliminaryLow,
        preliminaryHigh: range.preliminaryHigh,
        marketReferenceId: reference.id,
      };
      newStatus = 'PRELIMINARY_READY';
    }

    const [version] = await prisma.$transaction([
      prisma.valuationVersion.create({ data: versionData }),
      prisma.valuation.update({
        where: { id: valuation.id },
        data: { status: newStatus, currentVersion: nextVersionNumber },
      }),
    ]);

    await recordAuditLog({
      ...actorMeta(req),
      action: 'CALCULATE_PRELIMINARY',
      entityType: 'Valuation',
      entityId: valuation.id,
      newValues: { status: newStatus, versionNumber: nextVersionNumber },
    });

    res.json({ data: version, meta: { version: nextVersionNumber } });
  } catch (error) {
    console.error('Calculate preliminary valuation error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка предварительного расчёта' } });
  }
});

const addComparableSchema = z.object({
  sourceRef: z.string().min(1),
  checkedAt: z.coerce.date(),
  askingPrice: z.number().positive(),
  totalArea: z.number().positive(),
  pricePerM2: z.number().positive().optional(),
  compatibility: z.enum(['DIRECT', 'CLOSE', 'MARKET_CONTEXT']),
  included: z.boolean().default(true),
  reasonExcluded: z.string().optional(),
});

// POST /api/valuations/:id/comparables — добавить аналог к текущей (ещё не
// подтверждённой) версии оценки.
valuationsRouter.post('/:id/comparables', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = addComparableSchema.parse(req.body);

    const valuation = await prisma.valuation.findUnique({ where: { id: req.params.id } });
    if (!valuation) {
      res.status(404).json({ error: { code: 'not_found', message: 'Оценка не найдена' } });
      return;
    }

    const latestVersion = await prisma.valuationVersion.findUnique({
      where: { valuationId_versionNumber: { valuationId: valuation.id, versionNumber: valuation.currentVersion } },
    });
    if (!latestVersion) {
      res.status(422).json({
        error: { code: 'business_rule_failed', message: 'Сначала выполните предварительный расчёт' },
      });
      return;
    }
    if (latestVersion.isImmutable) {
      res.status(409).json({
        error: { code: 'state_transition_blocked', message: 'Версия уже подтверждена и неизменяема', blockers: [{ code: 'version_immutable' }] },
      });
      return;
    }

    const normalizedRef = normalizeSourceRef(body.sourceRef);
    const existing = await prisma.comparable.findUnique({
      where: { valuationVersionId_sourceRef: { valuationVersionId: latestVersion.id, sourceRef: normalizedRef } },
    });
    if (existing) {
      res.status(409).json({
        error: { code: 'state_transition_blocked', message: 'Такой аналог уже добавлен', blockers: [{ code: 'duplicate_comparable' }] },
      });
      return;
    }

    const comparable = await prisma.comparable.create({
      data: {
        valuationVersionId: latestVersion.id,
        sourceRef: normalizedRef,
        checkedAt: body.checkedAt,
        askingPrice: body.askingPrice,
        totalArea: body.totalArea,
        pricePerM2: body.pricePerM2 ?? body.askingPrice / body.totalArea,
        compatibility: body.compatibility,
        included: body.included,
        reasonExcluded: body.reasonExcluded,
      },
    });

    if (valuation.status !== 'COMPARABLE_COLLECTION' && valuation.status !== 'HUMAN_REVIEW') {
      await prisma.valuation.update({ where: { id: valuation.id }, data: { status: 'COMPARABLE_COLLECTION' } });
    }

    await recordAuditLog({
      ...actorMeta(req),
      action: 'ADD_COMPARABLE',
      entityType: 'ValuationVersion',
      entityId: latestVersion.id,
      newValues: { sourceRef: normalizedRef, included: body.included },
    });

    res.status(201).json({ data: comparable });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Add comparable error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка добавления аналога' } });
  }
});

const confirmSchema = z.object({
  confirmedLow: z.number().positive(),
  confirmedHigh: z.number().positive(),
  urgentLow: z.number().positive(),
  urgentHigh: z.number().positive(),
  recommendedLaunchPrice: z.number().positive(),
  maxLaunchPrice: z.number().positive(),
  liquidity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  decision: z.enum(['ACCEPTED', 'ACCEPTED_WITH_PRICE_CONDITION', 'REJECTED']),
  reviewerReason: z.string().min(3),
  expectedVersion: z.number().int().min(1),
  manualOverride: z.boolean().default(false),
});

// POST /api/valuations/:id/confirm
valuationsRouter.post('/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = confirmSchema.parse(req.body);

    const valuation = await prisma.valuation.findUnique({ where: { id: req.params.id } });
    if (!valuation) {
      res.status(404).json({ error: { code: 'not_found', message: 'Оценка не найдена' } });
      return;
    }
    if (valuation.currentVersion !== body.expectedVersion) {
      res.status(409).json({ error: { code: 'version_conflict', message: 'Версия устарела' } });
      return;
    }

    const latestVersion = await prisma.valuationVersion.findUnique({
      where: { valuationId_versionNumber: { valuationId: valuation.id, versionNumber: valuation.currentVersion } },
      include: { comparables: true },
    });
    if (!latestVersion) {
      res.status(422).json({ error: { code: 'business_rule_failed', message: 'Нет версии для подтверждения' } });
      return;
    }
    if (latestVersion.isImmutable) {
      res.status(409).json({
        error: { code: 'state_transition_blocked', message: 'Версия уже подтверждена', blockers: [{ code: 'version_immutable' }] },
      });
      return;
    }

    const includedCount = latestVersion.comparables.filter((c) => c.included).length;
    const guard = canConfirmValuation(includedCount, body.manualOverride);
    if (!guard.allowed) {
      res.status(422).json({
        error: { code: 'business_rule_failed', message: 'Недостаточно аналогов для подтверждения', blockers: [{ code: 'insufficient_comparables', detail: guard.reason }] },
      });
      return;
    }

    const finalStatus =
      body.decision === 'ACCEPTED'
        ? 'ACCEPTED'
        : body.decision === 'ACCEPTED_WITH_PRICE_CONDITION'
          ? 'ACCEPTED_WITH_PRICE_CONDITION'
          : 'REJECTED';

    const [updatedVersion] = await prisma.$transaction([
      prisma.valuationVersion.update({
        where: { id: latestVersion.id },
        data: {
          confirmedLow: body.confirmedLow,
          confirmedHigh: body.confirmedHigh,
          urgentLow: body.urgentLow,
          urgentHigh: body.urgentHigh,
          recommendedLaunchPrice: body.recommendedLaunchPrice,
          maxLaunchPrice: body.maxLaunchPrice,
          liquidity: body.liquidity,
          confidence: body.confidence,
          decision: body.decision,
          reviewerReason: body.reviewerReason,
          reviewerId: req.user?.userId,
          reviewedAt: new Date(),
          isImmutable: true,
        },
      }),
      prisma.valuation.update({ where: { id: valuation.id }, data: { status: finalStatus } }),
    ]);

    await recordAuditLog({
      ...actorMeta(req),
      action: 'CONFIRM',
      entityType: 'Valuation',
      entityId: valuation.id,
      newValues: { decision: body.decision, status: finalStatus },
      reason: body.reviewerReason,
    });

    res.json({ data: updatedVersion, meta: { version: valuation.currentVersion } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Confirm valuation error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка подтверждения оценки' } });
  }
});
