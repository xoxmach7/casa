/**
 * Подписка агентства на портал вторички.
 *
 * Здесь подписка — не столько источник денег, сколько РЫЧАГ. Комиссию с
 * агента, который познакомил стороны и увёл сделку, взыскать нечем, если
 * ему нечего терять. Отключение от базы — единственная санкция, которая
 * работает сразу, поэтому проверка живёт в middleware, а не в отдельной
 * админской кнопке.
 *
 * Существующая модель `Subscription` для этого не годится: она висит на
 * пользователе, ставится руками админом и не проверяется в коде нигде.
 * Её не трогаем — она обслуживает обучение и CRM.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import type { MarketplacePlan } from '@prisma/client';

/** Умолчания тарифов. Значения на конкретной подписке лежат в записи. */
export const PLAN_LIMITS: Record<MarketplacePlan, { maxActiveFixations: number; maxAgents: number }> = {
  TRIAL: { maxActiveFixations: 3, maxAgents: 2 },
  START: { maxActiveFixations: 15, maxAgents: 5 },
  PRO: { maxActiveFixations: 60, maxAgents: 20 },
  ENTERPRISE: { maxActiveFixations: 1000, maxAgents: 500 },
};

/**
 * Чья подписка покрывает этого пользователя.
 *
 * Агентство в системе — это пользователь с ролью AGENCY, а его сотрудники
 * привязаны через `curatorId`. Независимый агент платит сам за себя.
 */
export async function resolveAgencyId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, curatorId: true },
  });
  if (!user) return userId;
  if (user.role === 'AGENCY') return user.id;
  if (user.curatorId) {
    const curator = await prisma.user.findUnique({
      where: { id: user.curatorId },
      select: { id: true, role: true },
    });
    if (curator?.role === 'AGENCY') return curator.id;
  }
  return user.id;
}

export async function getActiveSubscription(agencyId: string) {
  const subscription = await prisma.agencySubscription.findFirst({
    where: { agencyId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (!subscription) return null;
  // Истечение проверяем по времени, а не доверяем полю status: срок мог
  // пройти без того, чтобы кто-то запустил переключение статусов.
  if (subscription.expiresAt && subscription.expiresAt.getTime() < Date.now()) return null;
  return subscription;
}

/** Сколько фиксаций агентства сейчас живые (считаются к лимиту тарифа). */
export const LIVE_FIXATION_STATUSES = [
  'SENT',
  'DUPLICATE_CHECK',
  'CONFIRMED',
  'SHOWN',
  'OFFER_MADE',
] as const;

export async function countLiveFixations(agencyId: string): Promise<number> {
  return prisma.secondaryFixation.count({
    where: {
      status: { in: LIVE_FIXATION_STATUSES as unknown as any },
      OR: [{ agencyId }, { agentId: agencyId }],
    },
  });
}

declare global {
  namespace Express {
    interface Request {
      marketplaceAgencyId?: string;
    }
  }
}

/**
 * Гейт портала: без действующей подписки агент не видит контакты и не может
 * фиксировать. ADMIN и COORDINATOR — сотрудники CASA, их подписка не
 * касается; собственник платформой не пользуется как покупательской стороной.
 */
export function requireMarketplaceAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role === 'ADMIN' || req.user.role === 'COORDINATOR') {
      req.marketplaceAgencyId = req.user.userId;
      next();
      return;
    }
    try {
      const agencyId = await resolveAgencyId(req.user.userId);
      const subscription = await getActiveSubscription(agencyId);
      if (!subscription) {
        res.status(403).json({
          error: 'Нет действующей подписки на портал вторички',
          code: 'MARKETPLACE_SUBSCRIPTION_REQUIRED',
        });
        return;
      }
      req.marketplaceAgencyId = agencyId;
      next();
    } catch (error) {
      console.error('Marketplace access check failed:', error);
      res.status(500).json({ error: 'Ошибка проверки подписки' });
    }
  };
}
