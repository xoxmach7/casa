/**
 * Кабинет собственника на портале вторички.
 *
 * Единственная роль, которая может завести объект вторички. Агенты приходят
 * только с покупателем — см. гейт 1 раздела 6 спеки.
 *
 * Объект после создания попадает в MODERATION и не виден агентам, пока
 * координатор не проверит его и собственник не примет условия договора.
 * Два разных гейта: модерация отвечает за достоверность, договор — за то,
 * что комиссия стала обязательством ДО того, как объект увидели.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  createAgreement,
  acceptAgreement,
  activeAgreementFor,
  ListingAgreementError,
} from '../lib/marketplace/listing-agreement.service';
import { declareListingExit, ListingExitError } from '../lib/marketplace/listing-exit.service';
import { LISTING_TIERS } from '../lib/marketplace/tiers';

export const marketplaceOwnerRouter = Router();
marketplaceOwnerRouter.use(authenticate);
marketplaceOwnerRouter.use(requireRole('OWNER', 'ADMIN', 'COORDINATOR'));

/** Карточка продавца текущего собственника. */
async function sellerForUser(userId: string) {
  return prisma.seller.findFirst({ where: { userId } });
}

const createListingSchema = z.object({
  rooms: z.coerce.number().int().min(1).max(10),
  residentialComplex: z.string().min(2, 'Укажите ЖК или дом'),
  district: z.string().min(2, 'Укажите район'),
  address: z.string().min(3, 'Укажите адрес'),
  area: z.coerce.number().positive('Укажите площадь'),
  floor: z.coerce.number().int().min(-1).max(100),
  totalFloors: z.coerce.number().int().min(1).max(100),
  yearBuilt: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 5),
  price: z.coerce.number().positive('Укажите цену'),
  description: z.string().max(4000).optional(),
  images: z.array(z.string().max(1000)).max(30).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

// GET /api/marketplace/owner/me — профиль собственника
marketplaceOwnerRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const seller = await sellerForUser(req.user!.userId);
    if (!seller) {
      res.status(404).json({ error: 'Карточка собственника не найдена' });
      return;
    }
    res.json(seller);
  } catch (error) {
    console.error('Owner profile error:', error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// GET /api/marketplace/owner/tiers — условия двух уровней договора
marketplaceOwnerRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json(LISTING_TIERS);
});

// GET /api/marketplace/owner/listings — мои объекты
marketplaceOwnerRouter.get('/listings', async (req: Request, res: Response): Promise<void> => {
  try {
    const seller = await sellerForUser(req.user!.userId);
    if (!seller) {
      res.json({ listings: [] });
      return;
    }

    const listings = await prisma.crmProperty.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: {
        listingAgreements: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { secondaryFixations: true, shows: true, offers: true } },
      },
    });

    res.json({ listings });
  } catch (error) {
    console.error('Owner listings error:', error);
    res.status(500).json({ error: 'Ошибка получения объектов' });
  }
});

// POST /api/marketplace/owner/listings — разместить квартиру
marketplaceOwnerRouter.post('/listings', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createListingSchema.parse(req.body);
    const seller = await sellerForUser(req.user!.userId);
    if (!seller) {
      res.status(404).json({ error: 'Карточка собственника не найдена' });
      return;
    }

    const property = await prisma.crmProperty.create({
      data: {
        ...data,
        images: data.images ?? [],
        sellerId: seller.id,
        // brokerId означает «кто ведёт объект». До назначения координатора
        // это сам собственник — поле обязательное, а придумывать ему
        // фиктивного брокера хуже, чем сказать правду.
        brokerId: req.user!.userId,
        listingSource: 'OWNER_SELF',
        // Не ACTIVE: объект не виден агентам, пока его не проверили и пока
        // собственник не принял условия договора.
        status: 'MODERATION',
        funnelStage: 'CREATED',
      },
    });

    res.status(201).json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Ошибка создания объекта' });
  }
});

type OwnListing =
  | { ok: true; property: { id: string; sellerId: string } }
  | { ok: false; status: number; message: string };

/** Проверяет, что объект принадлежит текущему собственнику. */
async function assertOwnListing(req: Request, propertyId: string): Promise<OwnListing> {
  const property = await prisma.crmProperty.findUnique({
    where: { id: propertyId },
    select: { id: true, sellerId: true, seller: { select: { userId: true } } },
  });
  // 404, а не 403: чужой объект не должен подтверждать своё существование.
  if (!property) return { ok: false, status: 404, message: 'Объект не найден' };
  if (req.user!.role === 'OWNER' && property.seller?.userId !== req.user!.userId) {
    return { ok: false, status: 404, message: 'Объект не найден' };
  }
  return { ok: true, property: { id: property.id, sellerId: property.sellerId } };
}

// POST /api/marketplace/owner/listings/:id/agreement — выбрать условия
marketplaceOwnerRouter.post(
  '/listings/:id/agreement',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const check = await assertOwnListing(req, req.params.id);
      if (!check.ok) {
        res.status(check.status).json({ error: check.message });
        return;
      }

      const tier = req.body?.tier;
      if (tier !== 'BASIC' && tier !== 'EXCLUSIVE') {
        res.status(400).json({ error: 'Уровень договора должен быть BASIC или EXCLUSIVE' });
        return;
      }

      const agreement = await createAgreement({
        propertyId: check.property.id,
        sellerId: check.property.sellerId,
        tier,
      });
      res.status(201).json(agreement);
    } catch (error) {
      if (error instanceof ListingAgreementError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Create agreement error:', error);
      res.status(500).json({ error: 'Ошибка создания договора' });
    }
  },
);

// POST /api/marketplace/owner/agreements/:id/accept — принять условия
marketplaceOwnerRouter.post(
  '/agreements/:id/accept',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const agreement = await prisma.listingAgreement.findUnique({
        where: { id: req.params.id },
        select: { id: true, seller: { select: { userId: true } } },
      });
      if (!agreement) {
        res.status(404).json({ error: 'Договор не найден' });
        return;
      }
      if (req.user!.role === 'OWNER' && agreement.seller?.userId !== req.user!.userId) {
        res.status(404).json({ error: 'Договор не найден' });
        return;
      }

      const evidence =
        typeof req.body?.evidence === 'string' && req.body.evidence.trim()
          ? req.body.evidence.trim()
          : `Оферта принята в кабинете собственника ${new Date().toISOString()}`;

      const accepted = await acceptAgreement(req.params.id, evidence);
      res.json(accepted);
    } catch (error) {
      if (error instanceof ListingAgreementError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Accept agreement error:', error);
      res.status(500).json({ error: 'Ошибка принятия договора' });
    }
  },
);

// GET /api/marketplace/owner/listings/:id/interest — кто интересуется
//
// Собственник видит активность агентов, но не видит покупателей: имя и
// телефон покупателя принадлежат агенту, который его привёл.
marketplaceOwnerRouter.get(
  '/listings/:id/interest',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const check = await assertOwnListing(req, req.params.id);
      if (!check.ok) {
        res.status(check.status).json({ error: check.message });
        return;
      }

      const fixations = await prisma.secondaryFixation.findMany({
        where: { propertyId: check.property.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          agent: { select: { id: true, firstName: true, lastName: true, phone: true } },
          agency: { select: { id: true, companyName: true, firstName: true, lastName: true } },
        },
      });

      res.json({ fixations });
    } catch (error) {
      console.error('Listing interest error:', error);
      res.status(500).json({ error: 'Ошибка получения активности' });
    }
  },
);

const exitSchema = z.object({
  outcome: z.enum(['SOLD_VIA_PLATFORM', 'SOLD_OUTSIDE', 'NOT_SOLD', 'WITHDRAWN']),
  buyerPhone: z.string().max(30).optional().nullable(),
  declaredPrice: z.string().max(20).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
});

// POST /api/marketplace/owner/listings/:id/exit — снять объект
//
// Единственный способ снять объект. Опрос обязателен: без ответа «кому
// продано» платформа никогда не узнает о сделке.
marketplaceOwnerRouter.post(
  '/listings/:id/exit',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const check = await assertOwnListing(req, req.params.id);
      if (!check.ok) {
        res.status(check.status).json({ error: check.message });
        return;
      }

      const data = exitSchema.parse(req.body);
      const exit = await declareListingExit({
        propertyId: check.property.id,
        outcome: data.outcome,
        buyerPhone: data.buyerPhone ?? null,
        declaredPrice: data.declaredPrice ?? null,
        declaredBy: req.user!.userId,
        comment: data.comment ?? null,
      });

      res.status(201).json({
        exit: { id: exit.id, outcome: exit.outcome, createdAt: exit.createdAt },
        // Собственнику не сообщаем, что открыт спор: это внутреннее событие,
        // и разбирать его будет человек, а не уведомление.
        message: 'Объект снят с площадки',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Неверные данные', details: error.errors });
        return;
      }
      if (error instanceof ListingExitError) {
        res.status(error.status).json({ error: error.message, code: error.code });
        return;
      }
      console.error('Listing exit error:', error);
      res.status(500).json({ error: 'Ошибка снятия объекта' });
    }
  },
);

// GET /api/marketplace/owner/listings/:id/agreement — действующий договор
marketplaceOwnerRouter.get(
  '/listings/:id/agreement',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const check = await assertOwnListing(req, req.params.id);
      if (!check.ok) {
        res.status(check.status).json({ error: check.message });
        return;
      }
      const agreement = await activeAgreementFor(check.property.id);
      res.json({ agreement });
    } catch (error) {
      console.error('Get agreement error:', error);
      res.status(500).json({ error: 'Ошибка получения договора' });
    }
  },
);
