import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';

// ADMIN moderation queue for the CRM landing's "Запросить доступ" form —
// see public-landing-leads.routes.ts for the public submission side.
export const landingLeadsRouter = Router();
landingLeadsRouter.use(authenticate);
landingLeadsRouter.use(requireRole('ADMIN'));

// GET /api/admin/landing-leads?status=NEW
landingLeadsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;

    const leads = await prisma.landingLead.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });

    res.json(leads);
  } catch (error) {
    console.error('List landing leads error:', error);
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
});

const decisionSchema = z.object({
  decision: z.enum(['CONTACTED', 'REJECTED']),
});

// PATCH /api/admin/landing-leads/:id/decision
landingLeadsRouter.patch(
  '/:id/decision',
  validate(decisionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { decision } = req.body as { decision: 'CONTACTED' | 'REJECTED' };

      const lead = await prisma.landingLead.findUnique({ where: { id } });
      if (!lead) {
        res.status(404).json({ error: 'Заявка не найдена' });
        return;
      }

      const updated = await prisma.landingLead.update({
        where: { id },
        data: {
          status: decision,
          reviewedAt: new Date(),
          reviewedById: req.user!.userId,
        },
      });

      res.json(updated);
    } catch (error) {
      console.error('Landing lead decision error:', error);
      res.status(500).json({ error: 'Ошибка обработки заявки' });
    }
  }
);
