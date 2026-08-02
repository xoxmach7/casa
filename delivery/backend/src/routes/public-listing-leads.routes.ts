// =========================================
// PUBLIC LISTING LEADS (casa40-main integration, 2026-08-02)
// "Записаться на просмотр" on the casa.kz public catalog — creates a
// PublicListingLead (buyer name/phone tied to a property), distinct from
// the simpler ViewingRequest log used elsewhere: this lead is meant to be
// worked by the lightweight public-listing admin (financing/viewing time/
// status), not the full broker CRM funnel.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const publicListingLeadsRouter = Router();

const createLeadSchema = z.object({
  buyerName: z.string().min(1),
  buyerPhone: z.string().min(1),
  comment: z.string().optional(),
});

// POST /api/public/listings/:propertyId/leads
publicListingLeadsRouter.post('/:propertyId/leads', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const data = createLeadSchema.parse(req.body);

    const property = await prisma.crmProperty.findFirst({
      where: { id: propertyId, funnelStage: 'LEADS', publishedAt: { not: null }, status: 'ACTIVE' },
    });
    if (!property) {
      res.status(404).json({ error: 'Объявление не найдено' });
      return;
    }

    const lead = await prisma.publicListingLead.create({
      data: {
        propertyId,
        buyerName: data.buyerName,
        buyerPhone: data.buyerPhone,
        comment: data.comment,
      },
    });

    res.status(201).json({ success: true, leadId: lead.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Public listing lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
