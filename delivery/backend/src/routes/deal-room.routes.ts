// =========================================
// DEAL ROOM ROUTES (CASA Developer Handoff v2.0, 04_CASA_Deal_Room_Spec)
// Отдельный контур от deals.routes.ts (существующий брокерский Kanban) —
// строго для вторички, открывается первым формальным офером. См. gap-audit
// и schema.prisma комментарий над SecondaryDeal.
//
// Роли: комнату ведёт COORDINATOR (ADMIN может всё). ANALYST видит сделку,
// но не двигает её — переходы, задаток и бронь ему закрыты.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../lib/audit-log.service';
import {
  availableDealRoomTransitions,
  canTransitionDealRoom,
  canSetGreen2,
  canDraftDeposit,
  canActivateBooking,
  canProceedToNotary,
  DealRoomStage,
} from '../lib/deal-room.service';

export const dealRoomRouter = Router();

const READ_ROLES = ['ADMIN', 'COORDINATOR', 'ANALYST'] as const;
const COORDINATE_ROLES = ['ADMIN', 'COORDINATOR'] as const;

dealRoomRouter.use(authenticate, requireRole(...READ_ROLES));

function actorMeta(req: Request) {
  return { actorUserId: req.user?.userId, actorRole: req.user?.role };
}

// GET /api/deal-room — доска сделок вторички.
// Без этого эндпоинта модуль был write-only: комнату можно было открыть и
// двигать по стадиям, но нигде не увидеть.
dealRoomRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = z
      .object({
        stage: z.string().optional(),
        trafficLight: z.enum(['RED', 'YELLOW', 'GREEN_1', 'GREEN_2']).optional(),
        propertyId: z.string().optional(),
        buyerId: z.string().optional(),
        // По умолчанию доска показывает работу в процессе, а не архив.
        includeClosed: z.coerce.boolean().default(false),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where: any = {};
    if (query.stage) where.stage = query.stage;
    if (query.trafficLight) where.trafficLight = query.trafficLight;
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.buyerId) where.buyerId = query.buyerId;
    if (!query.includeClosed && !query.stage) where.stage = { notIn: ['SOLD', 'FAILED'] };

    const [total, deals] = await Promise.all([
      prisma.secondaryDeal.count({ where }),
      prisma.secondaryDeal.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          property: { select: { id: true, residentialComplex: true, district: true, address: true, rooms: true, area: true } },
          buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          coordinator: { select: { id: true, firstName: true, lastName: true } },
          precheck: { select: { completenessPercent: true, hasBlockingRisk: true } },
          deposit: { select: { status: true, amount: true } },
        },
      }),
    ]);

    res.json({
      data: deals,
      meta: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('List deal rooms error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка получения списка сделок' } });
  }
});

// GET /api/deal-room/:id — карточка сделки: pre-check, задаток, бронь, риски,
// доступные переходы и история действий.
dealRoomRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deal = await prisma.secondaryDeal.findUnique({
      where: { id: req.params.id },
      include: {
        property: true,
        buyer: true,
        offer: true,
        coordinator: { select: { id: true, firstName: true, lastName: true, email: true } },
        precheck: true,
        deposit: true,
        booking: true,
        risks: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!deal) {
      res.status(404).json({ error: { code: 'not_found', message: 'Сделка не найдена' } });
      return;
    }

    const history = await prisma.auditLog.findMany({
      where: { entityType: 'SecondaryDeal', entityId: deal.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const availableStages = availableDealRoomTransitions(deal.stage as DealRoomStage);

    res.json({ data: { ...deal, history }, meta: { version: deal.version, availableStages } });
  } catch (error) {
    console.error('Get deal room error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка получения сделки' } });
  }
});

// POST /api/deal-room — открыть комнату сделки по первому формальному оферу.
// Идемпотентно: ровно один активный SecondaryDeal на property+buyer.
dealRoomRouter.post('/', requireRole(...COORDINATE_ROLES), async (req: Request, res: Response): Promise<void> => {
  try {
    const { offerId } = z.object({ offerId: z.string().min(1) }).parse(req.body);

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { secondaryDeal: true },
    });
    if (!offer) {
      res.status(404).json({ error: { code: 'not_found', message: 'Оффер не найден' } });
      return;
    }
    if (offer.secondaryDeal) {
      // Идемпотентность — повторный вызов на тот же оффер возвращает тот же Deal.
      res.status(200).json({ data: offer.secondaryDeal });
      return;
    }

    const existingActiveDeal = await prisma.secondaryDeal.findFirst({
      where: {
        propertyId: offer.propertyId,
        buyerId: offer.buyerId,
        stage: { notIn: ['SOLD', 'FAILED'] },
      },
    });
    if (existingActiveDeal) {
      res.status(409).json({
        error: {
          code: 'state_transition_blocked',
          message: 'По этой паре объект+покупатель уже есть активная сделка',
          blockers: [{ code: 'active_deal_exists', dealId: existingActiveDeal.id }],
        },
      });
      return;
    }

    const deal = await prisma.secondaryDeal.create({
      data: {
        propertyId: offer.propertyId,
        buyerId: offer.buyerId,
        offerId: offer.id,
        coordinatorId: req.user?.userId,
      },
    });
    await prisma.dealPrecheck.create({ data: { dealId: deal.id } });
    await prisma.dealDeposit.create({ data: { dealId: deal.id } });
    await prisma.dealBooking.create({ data: { dealId: deal.id } });

    await recordAuditLog({
      ...actorMeta(req),
      action: 'OPEN_DEAL_ROOM',
      entityType: 'SecondaryDeal',
      entityId: deal.id,
      newValues: { offerId, propertyId: offer.propertyId, buyerId: offer.buyerId },
    });

    res.status(201).json({ data: deal });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Open deal room error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка открытия комнаты сделки' } });
  }
});

const transitionSchema = z.object({
  targetStage: z.enum([
    'SELLER_REVIEW', 'COUNTEROFFER_SENT', 'PRICE_AGREED', 'PRECHECK_IN_PROGRESS',
    'YELLOW_BLOCKED', 'GREEN_1', 'GREEN_2', 'DEPOSIT_AGREEMENT_DRAFTING',
    'DEPOSIT_AGREEMENT_SENT', 'DEPOSIT_AGREEMENT_SIGNED', 'DEPOSIT_TRANSFER_PENDING',
    'BOOKING_ACTIVE', 'PAYMENT_ROUTE_IN_PROGRESS', 'READY_FOR_NOTARY',
    'NOTARY_SCHEDULED', 'REGISTRATION_OR_DISBURSEMENT', 'SOLD', 'FAILED',
  ]),
  reason: z.string().optional(),
  expectedVersion: z.number().int().min(1),
  finalChecklistComplete: z.boolean().optional(),
});

// POST /api/deal-room/:id/transition
dealRoomRouter.post('/:id/transition', requireRole(...COORDINATE_ROLES), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = transitionSchema.parse(req.body);
    const targetStage = body.targetStage as DealRoomStage;

    const deal = await prisma.secondaryDeal.findUnique({
      where: { id: req.params.id },
      include: { precheck: true, deposit: true, risks: true },
    });
    if (!deal) {
      res.status(404).json({ error: { code: 'not_found', message: 'Сделка не найдена' } });
      return;
    }
    if (deal.version !== body.expectedVersion) {
      res.status(409).json({ error: { code: 'version_conflict', message: 'Версия устарела' } });
      return;
    }
    if (!canTransitionDealRoom(deal.stage as DealRoomStage, targetStage)) {
      res.status(409).json({
        error: { code: 'state_transition_blocked', message: 'Переход недоступен', blockers: [{ code: 'invalid_transition' }] },
      });
      return;
    }

    if (targetStage === 'GREEN_2') {
      if (!deal.precheck) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Нет данных pre-check' } });
        return;
      }
      const check = canSetGreen2({
        hasBlockingRisk: deal.precheck.hasBlockingRisk,
        paymentRouteConfirmed: deal.precheck.paymentRouteConfirmed,
        missingAmount: Number(deal.precheck.missingAmount),
        mortgagePartConfirmed: deal.precheck.mortgagePartConfirmed,
      });
      if (!check.allowed) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Green 2 запрещён', blockers: check.blockers.map((code) => ({ code })) } });
        return;
      }
    }

    if (targetStage === 'DEPOSIT_AGREEMENT_DRAFTING') {
      const check = canDraftDeposit(deal.stage as DealRoomStage);
      if (!check.allowed) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Черновик задатка запрещён', blockers: check.blockers.map((code) => ({ code })) } });
        return;
      }
    }

    if (targetStage === 'BOOKING_ACTIVE') {
      if (!deal.deposit) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Нет данных о задатке' } });
        return;
      }
      const check = canActivateBooking({
        status: deal.deposit.status,
        proofFileAssetId: deal.deposit.proofFileAssetId,
        coordinatorVerified: deal.deposit.coordinatorVerified,
      });
      if (!check.allowed) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Бронь запрещена', blockers: check.blockers.map((code) => ({ code })) } });
        return;
      }
    }

    if (targetStage === 'READY_FOR_NOTARY' || targetStage === 'NOTARY_SCHEDULED') {
      const hasOpenBlocker = deal.risks.some((r) => r.isBlocker && !r.resolvedAt);
      const check = canProceedToNotary(body.finalChecklistComplete ?? false, hasOpenBlocker);
      if (!check.allowed) {
        res.status(422).json({ error: { code: 'business_rule_failed', message: 'Нотариус недоступен', blockers: check.blockers.map((code) => ({ code })) } });
        return;
      }
    }

    if ((targetStage === 'SOLD' || targetStage === 'FAILED') && !body.reason) {
      res.status(400).json({ error: { code: 'validation_error', message: 'sold/failed требуют reason' } });
      return;
    }

    const updated = await prisma.secondaryDeal.update({
      where: { id: deal.id },
      data: {
        stage: targetStage,
        version: { increment: 1 },
        ...(targetStage === 'GREEN_1' || targetStage === 'GREEN_2' ? { trafficLight: targetStage } : {}),
        ...(targetStage === 'YELLOW_BLOCKED' ? { trafficLight: 'YELLOW' } : {}),
        ...(targetStage === 'SOLD' || targetStage === 'FAILED'
          ? { outcomeAt: new Date(), outcomeReason: body.reason }
          : {}),
      },
    });

    await recordAuditLog({
      ...actorMeta(req),
      action: 'TRANSITION',
      entityType: 'SecondaryDeal',
      entityId: deal.id,
      oldValues: { stage: deal.stage },
      newValues: { stage: targetStage },
      reason: body.reason,
    });

    res.json({ data: updated, meta: { version: updated.version } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Deal room transition error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка перехода сделки' } });
  }
});

const verifyTransferSchema = z.object({
  proofType: z.enum(['bank_transfer', 'receipt', 'seller_confirmation', 'other']),
  fileAssetId: z.string().min(1),
  coordinatorVerification: z.literal(true),
  reason: z.string().min(3),
});

// POST /api/deal-room/:id/deposit/verify-transfer
dealRoomRouter.post('/:id/deposit/verify-transfer', requireRole(...COORDINATE_ROLES), async (req: Request, res: Response): Promise<void> => {
  try {
    const body = verifyTransferSchema.parse(req.body);

    const deal = await prisma.secondaryDeal.findUnique({ where: { id: req.params.id }, include: { deposit: true } });
    if (!deal || !deal.deposit) {
      res.status(404).json({ error: { code: 'not_found', message: 'Сделка или задаток не найдены' } });
      return;
    }
    if (deal.deposit.status !== 'SIGNED' && deal.deposit.status !== 'TRANSFER_PENDING') {
      res.status(409).json({
        error: { code: 'state_transition_blocked', message: 'Задаток ещё не подписан', blockers: [{ code: 'deposit_not_signed' }] },
      });
      return;
    }

    const updated = await prisma.dealDeposit.update({
      where: { id: deal.deposit.id },
      data: {
        status: 'TRANSFER_PENDING',
        proofType: body.proofType,
        proofFileAssetId: body.fileAssetId,
        coordinatorVerified: true,
        verifiedBy: req.user?.userId,
        verifiedAt: new Date(),
      },
    });

    await recordAuditLog({
      ...actorMeta(req),
      action: 'VERIFY_DEPOSIT_TRANSFER',
      entityType: 'DealDeposit',
      entityId: updated.id,
      newValues: { proofType: body.proofType, coordinatorVerified: true },
      reason: body.reason,
    });

    res.json({ data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: { code: 'validation_error', fields: error.flatten() } });
      return;
    }
    console.error('Verify deposit transfer error:', error);
    res.status(500).json({ error: { code: 'internal_error', message: 'Ошибка подтверждения перевода задатка' } });
  }
});
