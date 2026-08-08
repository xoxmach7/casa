import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// "Запросить доступ" form on the CRM marketing landing (delivery/frontend
// app/page.tsx and app/gpt-taste/page.tsx) — unauthenticated, held for ADMIN
// moderation via /api/admin/landing-leads before anyone acts on it.
export const publicLandingLeadsRouter = Router();

const landingLeadSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя'),
  phone: z.string().trim().min(1, 'Укажите телефон'),
  role: z.string().trim().min(1, 'Укажите роль'),
  source: z.string().trim().optional(),
});

publicLandingLeadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = landingLeadSchema.parse(req.body);

    const lead = await prisma.landingLead.create({
      data: {
        name: data.name,
        phone: data.phone,
        role: data.role,
        source: data.source || 'landing',
      },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'SYSTEM' as const,
          title: 'Новая заявка с лендинга',
          message: `${data.name} (${data.role}) запросил(а) доступ к CASA Pro — на модерации.`,
        })),
      });
    }

    res.json({ success: true, id: lead.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Landing lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
