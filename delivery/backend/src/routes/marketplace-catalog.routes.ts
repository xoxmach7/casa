/**
 * Витрина вторички для агента с покупателем.
 *
 * Три вещи, ради которых этот файл существует отдельно от crm-properties:
 *
 *  1. Здесь отдаются ЧУЖИЕ объекты — те, что завёл собственник. Обычные
 *     CRM-маршруты режут выборку по brokerId, и для витрины это неверно.
 *  2. Всё, что уходит наружу, проходит через маскировку: адрес, координаты,
 *     контакты и ссылки на внешние площадки скрыты до фиксации.
 *  3. Виден объявленный сплит — сколько агент получит, если приведёт
 *     покупателя. Без этой цифры ко-брокеридж не работает: никто не повезёт
 *     клиента на чужую квартиру ради неизвестного вознаграждения.
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { maskProperty } from '../lib/marketplace/masking';
import {
  requireMarketplaceAccess,
  getActiveSubscription,
  countLiveFixations,
} from '../lib/marketplace/subscription.service';
import {
  createFixation,
  advanceFixation,
  liveFixationFor,
  FixationError,
} from '../lib/marketplace/fixation.service';

export const marketplaceCatalogRouter = Router();
marketplaceCatalogRouter.use(authenticate);
marketplaceCatalogRouter.use(requireMarketplaceAccess());

/** Поля карточки в списке. Полный объект в выдачу не уходит. */
const LIST_FIELDS = {
  id: true,
  propertyType: true,
  rooms: true,
  residentialComplex: true,
  district: true,
  address: true,
  lat: true,
  lng: true,
  area: true,
  livingArea: true,
  kitchenArea: true,
  floor: true,
  totalFloors: true,
  yearBuilt: true,
  buildingType: true,
  repairState: true,
  actualCondition: true,
  price: true,
  pricePerSqm: true,
  images: true,
  description: true,
  publishedAt: true,
  krishaUrl: true,
  olxUrl: true,
  videoUrl: true,
} as const;

/** Ожидаемое вознаграждение агента по объявленным условиям договора. */
function expectedReward(
  price: Prisma.Decimal | null,
  commissionPercent: Prisma.Decimal,
  sharePercent: Prisma.Decimal,
): string | null {
  if (!price) return null;
  return new Prisma.Decimal(price)
    .mul(commissionPercent)
    .div(100)
    .mul(sharePercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toString();
}

// GET /api/marketplace/listings — каталог объектов
marketplaceCatalogRouter.get('/listings', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 20));
    const { district, rooms, minPrice, maxPrice } = req.query;

    const where: Prisma.CrmPropertyWhereInput = {
      status: 'ACTIVE',
      // Только объекты с действующим договором. Это гейт 2 раздела 6:
      // объект без договора не существует для агента.
      listingAgreements: { some: { status: 'ACTIVE' } },
    };
    if (district) where.district = String(district);
    if (rooms) where.rooms = Number(rooms);
    if (minPrice || maxPrice) {
      where.price = {
        ...(minPrice ? { gte: new Prisma.Decimal(String(minPrice)) } : {}),
        ...(maxPrice ? { lte: new Prisma.Decimal(String(maxPrice)) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      prisma.crmProperty.findMany({
        where,
        select: {
          ...LIST_FIELDS,
          // Продавца выбираем всегда, а прячет его маскировка. Иначе карточка
          // с открытой фиксацией обещает контакты и не показывает их.
          seller: { select: { id: true, firstName: true, lastName: true, phone: true } },
          listingAgreements: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { tier: true, commissionPercent: true, buyerAgentSharePercent: true },
          },
        },
        // Эксклюзив идёт выше — это часть того, что собственник за него получает.
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.crmProperty.count({ where }),
    ]);

    const agentId = req.user!.userId;
    const listings = await Promise.all(
      rows.map(async (row) => {
        const { listingAgreements, ...property } = row;
        const agreement = listingAgreements[0];
        const fixation = await liveFixationFor(property.id, agentId);
        const masked = maskProperty(property, {
          unlocked: Boolean(fixation),
          tier: agreement?.tier ?? null,
        });
        return {
          ...masked,
          tier: agreement?.tier ?? null,
          declaredSharePercent: agreement?.buyerAgentSharePercent?.toString() ?? null,
          expectedReward: agreement
            ? expectedReward(property.price, agreement.commissionPercent, agreement.buyerAgentSharePercent)
            : null,
          fixation: fixation
            ? { id: fixation.id, status: fixation.status, expiresAt: fixation.expiresAt }
            : null,
        };
      }),
    );

    // Эксклюзивы вперёд — сортировка после маскировки, чтобы не тащить tier
    // в SQL через связь.
    listings.sort((a, b) => (a.tier === 'EXCLUSIVE' ? -1 : 0) - (b.tier === 'EXCLUSIVE' ? -1 : 0));

    res.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Marketplace listings error:', error);
    res.status(500).json({ error: 'Ошибка получения каталога' });
  }
});

// GET /api/marketplace/listings/:id — карточка объекта
marketplaceCatalogRouter.get('/listings/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const property = await prisma.crmProperty.findFirst({
      where: {
        id: req.params.id,
        status: 'ACTIVE',
        listingAgreements: { some: { status: 'ACTIVE' } },
      },
      include: {
        listingAgreements: { where: { status: 'ACTIVE' }, take: 1 },
        seller: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const { listingAgreements, ...rest } = property;
    const agreement = listingAgreements[0];
    const fixation = await liveFixationFor(property.id, req.user!.userId);

    const masked = maskProperty(rest, {
      unlocked: Boolean(fixation),
      tier: agreement?.tier ?? null,
    });

    res.json({
      ...masked,
      tier: agreement?.tier ?? null,
      declaredSharePercent: agreement?.buyerAgentSharePercent?.toString() ?? null,
      expectedReward: agreement
        ? expectedReward(rest.price, agreement.commissionPercent, agreement.buyerAgentSharePercent)
        : null,
      fixation: fixation
        ? { id: fixation.id, status: fixation.status, expiresAt: fixation.expiresAt }
        : null,
    });
  } catch (error) {
    console.error('Marketplace listing error:', error);
    res.status(500).json({ error: 'Ошибка получения объекта' });
  }
});

// POST /api/marketplace/listings/:id/fixations — зафиксировать покупателя
marketplaceCatalogRouter.post(
  '/listings/:id/fixations',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const buyerId = req.body?.buyerId;
      if (typeof buyerId !== 'string' || !buyerId) {
        res.status(400).json({ error: 'Нужно указать покупателя' });
        return;
      }

      const fixation = await createFixation({
        propertyId: req.params.id,
        buyerId,
        agentId: req.user!.userId,
        agencyId: req.marketplaceAgencyId || req.user!.userId,
      });

      res.status(201).json(fixation);
    } catch (error) {
      if (error instanceof FixationError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Create fixation error:', error);
      res.status(500).json({ error: 'Ошибка фиксации' });
    }
  },
);

// GET /api/marketplace/fixations — мои фиксации
marketplaceCatalogRouter.get('/fixations', async (req: Request, res: Response): Promise<void> => {
  try {
    const fixations = await prisma.secondaryFixation.findMany({
      where: { agentId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            residentialComplex: true,
            district: true,
            rooms: true,
            area: true,
            price: true,
            images: true,
          },
        },
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    res.json({ fixations });
  } catch (error) {
    console.error('List fixations error:', error);
    res.status(500).json({ error: 'Ошибка получения фиксаций' });
  }
});

// PATCH /api/marketplace/fixations/:id/status — продвинуть по этапам
marketplaceCatalogRouter.patch(
  '/fixations/:id/status',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const fixation = await prisma.secondaryFixation.findUnique({
        where: { id: req.params.id },
        select: { agentId: true },
      });
      if (!fixation || fixation.agentId !== req.user!.userId) {
        res.status(404).json({ error: 'Фиксация не найдена' });
        return;
      }

      const updated = await advanceFixation(
        req.params.id,
        String(req.body?.status || ''),
        req.user!.userId,
        req.body?.note,
      );
      res.json(updated);
    } catch (error) {
      if (error instanceof FixationError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Advance fixation error:', error);
      res.status(500).json({ error: 'Ошибка смены статуса' });
    }
  },
);

// GET /api/marketplace/subscription — подписка и остаток лимита
marketplaceCatalogRouter.get('/subscription', async (req: Request, res: Response): Promise<void> => {
  try {
    const agencyId = req.marketplaceAgencyId || req.user!.userId;
    const [subscription, live] = await Promise.all([
      getActiveSubscription(agencyId),
      countLiveFixations(agencyId),
    ]);
    res.json({
      subscription,
      liveFixations: live,
      remainingFixations: subscription ? Math.max(0, subscription.maxActiveFixations - live) : 0,
    });
  } catch (error) {
    console.error('Marketplace subscription error:', error);
    res.status(500).json({ error: 'Ошибка получения подписки' });
  }
});
