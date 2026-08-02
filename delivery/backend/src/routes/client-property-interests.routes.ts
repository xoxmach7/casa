// =========================================
// CLIENT PROPERTY INTEREST ROUTES (CASA Developer Handoff v2.0 — Showings module)
// Промежуточный шаг между лидом/подборкой и запросом показа. См. схему —
// не связана FK с Show в этом проходе (см. gap-audit).
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { recordAuditLog } from '../lib/audit-log.service';

export const clientPropertyInterestsRouter = Router();
clientPropertyInterestsRouter.use(authenticate);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY'];

function scopeToOwnBroker(req: Request): { brokerId?: string } {
  if (RESTRICTED_ROLES.includes(req.user?.role || '')) {
    return { brokerId: req.user!.userId };
  }
  return {};
}

const createSchema = z.object({
  propertyId: z.string().min(1),
  buyerId: z.string().min(1),
  note: z.string().optional(),
});

// GET /api/client-property-interests
clientPropertyInterestsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where: any = { ...scopeToOwnBroker(req) };
    if (status) where.status = status;

    const interests = await prisma.clientPropertyInterest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, residentialComplex: true, district: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    res.json(interests);
  } catch (error) {
    console.error('List client property interests error:', error);
    res.status(500).json({ error: 'Ошибка получения списка интересов' });
  }
});

// POST /api/client-property-interests
clientPropertyInterestsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createSchema.parse(req.body);

    const [property, buyer] = await Promise.all([
      prisma.crmProperty.findUnique({ where: { id: body.propertyId } }),
      prisma.buyer.findUnique({ where: { id: body.buyerId } }),
    ]);
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }
    if (!buyer) {
      res.status(404).json({ error: 'Покупатель не найден' });
      return;
    }
    if (RESTRICTED_ROLES.includes(req.user?.role || '') && buyer.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const interest = await prisma.clientPropertyInterest.create({
      data: {
        propertyId: body.propertyId,
        buyerId: body.buyerId,
        brokerId: req.user!.userId,
        note: body.note,
      },
    });

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'CREATE',
      entityType: 'ClientPropertyInterest',
      entityId: interest.id,
      newValues: { propertyId: body.propertyId, buyerId: body.buyerId },
    });

    res.status(201).json(interest);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create client property interest error:', error);
    res.status(500).json({ error: 'Ошибка создания интереса к объекту' });
  }
});

// POST /api/client-property-interests/:id/close
clientPropertyInterestsRouter.post('/:id/close', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.clientPropertyInterest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Интерес не найден' });
      return;
    }
    if (RESTRICTED_ROLES.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const interest = await prisma.clientPropertyInterest.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await recordAuditLog({
      actorUserId: req.user?.userId,
      actorRole: req.user?.role,
      action: 'CLOSE',
      entityType: 'ClientPropertyInterest',
      entityId: interest.id,
    });

    res.json(interest);
  } catch (error) {
    console.error('Close client property interest error:', error);
    res.status(500).json({ error: 'Ошибка закрытия интереса к объекту' });
  }
});
