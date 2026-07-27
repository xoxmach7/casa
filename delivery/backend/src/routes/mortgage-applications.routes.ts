import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

export const mortgageApplicationsRouter = Router();
mortgageApplicationsRouter.use(authenticate);

const createSchema = z.object({
  clientId: z.string(),
  bankName: z.string(),
  programName: z.string().optional(),
  loanAmount: z.number().positive(),
  termMonths: z.number().int().positive(),
  interestRate: z.number().optional(),
});

// GET /api/mortgage-applications
mortgageApplicationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const where: any = {};
    if (['BROKER', 'REALTOR', 'AGENCY'].includes(req.user!.role)) {
      where.brokerId = req.user!.userId;
    }
    if (req.query.clientId) where.clientId = req.query.clientId;
    if (req.query.status) where.status = req.query.status;

    const apps = await prisma.mortgageApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
});

// POST /api/mortgage-applications
mortgageApplicationsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createSchema.parse(req.body);
    const app = await prisma.mortgageApplication.create({
      data: { ...data, brokerId: req.user!.userId, status: 'SUBMITTED' },
    });
    res.status(201).json(app);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Невалидные данные', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Ошибка создания заявки' });
  }
});

// PUT /api/mortgage-applications/:id/status
mortgageApplicationsRouter.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, responseNotes } = req.body;
    const app = await prisma.mortgageApplication.update({
      where: { id: req.params.id },
      data: {
        status,
        responseNotes,
        responseDate: ['APPROVED', 'REJECTED'].includes(status) ? new Date() : undefined,
      },
    });
    res.json(app);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});
