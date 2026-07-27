import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { DealStage, DealStatus } from '@prisma/client';

export const dealsRouter = Router();
dealsRouter.use(authenticate);

// Validation schemas
const createDealSchema = z.object({
  amount: z.number().positive('Сумма должна быть положительной'),
  commission: z.number().min(0, 'Комиссия не может быть отрицательной'),
  casaFee: z.number().min(0, 'Casa Fee не может быть отрицательным'),
  objectType: z.enum(['PROPERTY', 'APARTMENT', 'BOOKING']),
  objectId: z.string().optional(),
  clientId: z.string().optional(),
  notes: z.string().optional(),
  stage: z.nativeEnum(DealStage).optional(),
  color: z.string().optional(),
});

const updateDealSchema = z.object({
  amount: z.number().positive().optional(),
  commission: z.number().min(0).optional(),
  casaFee: z.number().min(0).optional(),
  status: z.nativeEnum(DealStatus).optional(),
  stage: z.nativeEnum(DealStage).optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/deals - список сделок
dealsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, stage, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) where.brokerId = req.user!.userId;
    if (status) where.status = status;
    if (stage) where.stage = stage;

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          broker: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.deal.count({ where }),
    ]);

    res.json({ deals, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Ошибка получения списка сделок' });
  }
});

// GET /api/deals/:id - детали сделки
dealsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        broker: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    });

    if (!deal) {
      res.status(404).json({ error: 'Сделка не найдена' });
      return;
    }

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && deal.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    res.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({ error: 'Ошибка получения сделки' });
  }
});

// POST /api/deals - создать сделку
dealsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createDealSchema.parse(req.body);

    const deal = await prisma.deal.create({
      data: { ...data, brokerId: req.user!.userId, status: 'IN_PROGRESS' },
      include: {
        broker: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (data.objectType === 'PROPERTY' && data.objectId) {
      await prisma.property.update({ where: { id: data.objectId }, data: { status: 'SOLD' } });
    }

    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Ошибка создания сделки' });
  }
});

// PUT /api/deals/:id - обновить сделку
dealsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateDealSchema.parse(req.body);

    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Сделка не найдена' });
      return;
    }

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Нет прав на изменение этой сделки' });
      return;
    }

    const updateData: any = { ...data };
    if (data.status === 'COMPLETED' && !existing.completedAt) {
      updateData.completedAt = new Date();
    }

    // Check if broker changed and notify
    if (updateData.brokerId && updateData.brokerId !== existing.brokerId) {
      await prisma.notification.create({
        data: {
          userId: updateData.brokerId,
          type: 'DEAL',
          title: 'Вам назначена сделка',
          message: `Вы назначены ответственным за сделку #${existing.id.slice(-4)}`,
          isRead: false
        }
      });
    }

    const updated = await prisma.deal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        broker: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Ошибка обновления сделки' });
  }
});

// DELETE /api/deals/:id - удалить сделку
dealsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Сделка не найдена' });
      return;
    }

    // Admin can delete anything, Broker/Realtor/Agency can only delete their own
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) {
      if (existing.brokerId !== req.user!.userId) {
        res.status(403).json({ error: 'Вы не можете удалить эту сделку' });
        return;
      }
    }

    await prisma.deal.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Ошибка удаления сделки' });
  }
});



// POST /api/deals/tradein - создать TradeIn сделку
dealsRouter.post('/tradein', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sellerId, projectId, oldPropertyId, newApartmentPrice, commissionPercent, clientId, notes } = req.body;

    if (!sellerId || !newApartmentPrice) {
      res.status(400).json({ error: 'sellerId и newApartmentPrice обязательны' });
      return;
    }

    const commission = (newApartmentPrice * (commissionPercent || 1.5)) / 100;
    const casaFee = commission * 0.2; // 20% от комиссии — Casa Fee

    const deal = await prisma.deal.create({
      data: {
        amount: newApartmentPrice,
        commission,
        casaFee,
        objectType: 'PROPERTY',
        objectId: oldPropertyId || null,
        clientId: clientId || null,
        isTradeIn: true,
        tradeInPropertyId: oldPropertyId || null,
        tradeInProjectId: projectId || null,
        tradeInCommission: commissionPercent || 1.5,
        notes: notes || `TradeIn сделка`,
        brokerId: req.user!.userId,
        source: 'MANUAL',
      },
    });

    res.status(201).json(deal);
  } catch (error) {
    console.error('Create TradeIn deal error:', error);
    res.status(500).json({ error: 'Ошибка создания TradeIn сделки' });
  }
});
