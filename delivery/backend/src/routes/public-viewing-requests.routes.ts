import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const publicViewingRequestsRouter = Router();

const viewingRequestSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
});

publicViewingRequestsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId, name, phone } = viewingRequestSchema.parse(req.body);

    const property = await prisma.crmProperty.findFirst({
      where: { id: propertyId, funnelStage: 'LEADS', publishedAt: { not: null }, status: 'ACTIVE' },
    });
    if (!property) {
      res.status(404).json({ error: 'Объявление не найдено' });
      return;
    }

    await prisma.viewingRequest.create({ data: { propertyId, name, phone } });

    res.status(201).json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Viewing request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
