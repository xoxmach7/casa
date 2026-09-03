/**
 * Административный контур портала вторички: подписки агентств, модерация
 * объектов собственников, споры о комиссии.
 *
 * Публикация объекта требует ОБОИХ условий: проверенных данных (модерация)
 * и принятого договора (обязательство по комиссии). Порядок между ними
 * произвольный, но опубликовать объект без второго нельзя — иначе агент
 * увидит квартиру раньше, чем собственник согласился платить.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { PLAN_LIMITS } from '../lib/marketplace/subscription.service';
import { assertPublishable, ListingAgreementError } from '../lib/marketplace/listing-agreement.service';
import { listOpenDisputes } from '../lib/marketplace/listing-exit.service';
import {
  createCommissionForSecondaryDeal,
  CommissionError,
} from '../lib/marketplace/commission.service';
import { expireStaleFixations } from '../lib/marketplace/fixation.service';

export const marketplaceAdminRouter = Router();
marketplaceAdminRouter.use(authenticate);
marketplaceAdminRouter.use(requireRole('ADMIN', 'COORDINATOR'));

const subscriptionSchema = z.object({
  agencyId: z.string().min(1),
  plan: z.enum(['TRIAL', 'START', 'PRO', 'ENTERPRISE']),
  expiresAt: z.string().datetime().optional().nullable(),
  amount: z.string().max(20).optional().nullable(),
  maxActiveFixations: z.coerce.number().int().min(0).optional(),
  maxAgents: z.coerce.number().int().min(0).optional(),
});

// GET /api/admin/marketplace/subscriptions
marketplaceAdminRouter.get('/subscriptions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await prisma.agencySubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        agency: {
          select: { id: true, email: true, companyName: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    res.json({ subscriptions });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});

// POST /api/admin/marketplace/subscriptions — выдать/переоформить подписку
marketplaceAdminRouter.post('/subscriptions', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = subscriptionSchema.parse(req.body);
    const limits = PLAN_LIMITS[data.plan];

    const agency = await prisma.user.findUnique({ where: { id: data.agencyId }, select: { id: true } });
    if (!agency) {
      res.status(404).json({ error: 'Агентство не найдено' });
      return;
    }

    const subscription = await prisma.$transaction(async (tx) => {
      // Старые подписки гасим: активной может быть только одна, иначе
      // непонятно, чей лимит применять.
      await tx.agencySubscription.updateMany({
        where: { agencyId: data.agencyId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      return tx.agencySubscription.create({
        data: {
          agencyId: data.agencyId,
          plan: data.plan,
          status: 'ACTIVE',
          maxActiveFixations: data.maxActiveFixations ?? limits.maxActiveFixations,
          maxAgents: data.maxAgents ?? limits.maxAgents,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          amount: data.amount ?? null,
        },
      });
    });

    res.status(201).json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Ошибка создания подписки' });
  }
});

// PATCH /api/admin/marketplace/subscriptions/:id/cancel
marketplaceAdminRouter.patch(
  '/subscriptions/:id/cancel',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await prisma.agencySubscription.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });
      res.json(updated);
    } catch (error) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({ error: 'Ошибка отмены подписки' });
    }
  },
);

// GET /api/admin/marketplace/moderation — объекты собственников на проверке
marketplaceAdminRouter.get('/moderation', async (_req: Request, res: Response): Promise<void> => {
  try {
    const listings = await prisma.crmProperty.findMany({
      where: { status: 'MODERATION', listingSource: { in: ['OWNER_SELF', 'COORDINATOR'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        seller: { select: { id: true, firstName: true, lastName: true, phone: true } },
        listingAgreements: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    res.json({ listings });
  } catch (error) {
    console.error('Moderation queue error:', error);
    res.status(500).json({ error: 'Ошибка получения очереди модерации' });
  }
});

// POST /api/admin/marketplace/listings/:id/approve — опубликовать
marketplaceAdminRouter.post(
  '/listings/:id/approve',
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Гейт публикации: без действующего договора объект не выходит в
      // витрину, сколько бы раз модератор ни нажал «одобрить».
      await assertPublishable(req.params.id);

      const property = await prisma.crmProperty.update({
        where: { id: req.params.id },
        data: { status: 'ACTIVE', funnelStage: 'LEADS', publishedAt: new Date() },
      });
      res.json(property);
    } catch (error) {
      if (error instanceof ListingAgreementError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Approve listing error:', error);
      res.status(500).json({ error: 'Ошибка публикации объекта' });
    }
  },
);

// POST /api/admin/marketplace/listings/:id/reject
marketplaceAdminRouter.post(
  '/listings/:id/reject',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const property = await prisma.crmProperty.update({
        where: { id: req.params.id },
        data: {
          status: 'NEEDS_INFORMATION',
          notes: typeof req.body?.reason === 'string' ? req.body.reason : null,
        },
      });
      res.json(property);
    } catch (error) {
      console.error('Reject listing error:', error);
      res.status(500).json({ error: 'Ошибка отклонения объекта' });
    }
  },
);

// GET /api/admin/marketplace/disputes — расхождения при снятии объектов
marketplaceAdminRouter.get('/disputes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const disputes = await listOpenDisputes();
    res.json({ disputes });
  } catch (error) {
    console.error('List disputes error:', error);
    res.status(500).json({ error: 'Ошибка получения споров' });
  }
});

// POST /api/admin/marketplace/deals/:id/commission — начислить комиссию
marketplaceAdminRouter.post(
  '/deals/:id/commission',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const commission = await createCommissionForSecondaryDeal(req.params.id);
      res.status(201).json(commission);
    } catch (error) {
      if (error instanceof CommissionError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Create secondary commission error:', error);
      res.status(500).json({ error: 'Ошибка начисления комиссии' });
    }
  },
);

// POST /api/admin/marketplace/fixations/expire — прогнать истёкшие фиксации
marketplaceAdminRouter.post('/fixations/expire', async (_req: Request, res: Response): Promise<void> => {
  try {
    const expired = await expireStaleFixations();
    res.json({ expired });
  } catch (error) {
    console.error('Expire fixations error:', error);
    res.status(500).json({ error: 'Ошибка обработки фиксаций' });
  }
});
