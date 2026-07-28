import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { pickBroker } from '../lib/lead-assignment';

export const publicBuyerLeadsRouter = Router();

const buyerLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  district: z.string().optional(),
  rooms: z.array(z.number().int().positive()).optional(),
  minBudget: z.number().positive().optional(),
  maxBudget: z.number().positive().optional(),
  notes: z.string().optional(),
});

publicBuyerLeadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = buyerLeadSchema.parse(req.body);

    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || null;

    const preferences: Prisma.JsonObject = {};
    if (data.district) preferences.district = data.district;
    if (data.rooms && data.rooms.length > 0) preferences.rooms = data.rooms;

    const existing = await prisma.buyer.findFirst({ where: { phone: data.phone } });

    if (existing) {
      const buyer = await prisma.buyer.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          minBudget: data.minBudget ?? null,
          maxBudget: data.maxBudget ?? null,
          preferences,
          notes: data.notes,
        },
      });

      await prisma.notification.create({
        data: {
          userId: buyer.brokerId,
          type: 'SYSTEM',
          title: 'Покупатель обновил критерии поиска',
          message: `${firstName} ${lastName ?? ''} обновил(а) параметры поиска квартиры.`.trim(),
          isRead: false,
        },
      });

      res.json({ success: true, buyerId: buyer.id });
      return;
    }

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const { brokerId } = pickBroker({
      distributionType: 'MANUAL',
      brokerPool: [],
      fallbackBrokerId: admin?.id,
    });

    if (!brokerId) {
      res.status(500).json({ error: 'No broker available to assign lead' });
      return;
    }

    const buyer = await prisma.buyer.create({
      data: {
        brokerId,
        firstName,
        lastName,
        phone: data.phone,
        minBudget: data.minBudget,
        maxBudget: data.maxBudget,
        preferences,
        notes: data.notes,
        status: 'NEW',
      },
    });

    await prisma.notification.create({
      data: {
        userId: brokerId,
        type: 'SYSTEM',
        title: 'Новый покупатель ищет объект',
        message: `${firstName} ${lastName ?? ''} оставил(а) критерии поиска квартиры.`.trim(),
        isRead: false,
      },
    });

    res.json({ success: true, buyerId: buyer.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Buyer lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
