import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

// Обратная связь от пользователей CRM — кнопка «Оставить обратную связь» в сайдбаре.
// POST доступен любому авторизованному; список читает только ADMIN.
export const feedbackRouter = Router();
feedbackRouter.use(authenticate);

const createFeedbackSchema = z.object({
  message: z.string().min(1, 'Напишите сообщение').max(4000),
  contact: z.string().max(200).optional(),
});

// POST /api/feedback — оставить обратную связь
feedbackRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createFeedbackSchema.parse(req.body);

    let userName: string | undefined;
    if (req.user?.userId) {
      const u = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { firstName: true, lastName: true },
      });
      if (u) userName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || undefined;
    }

    const fb = await prisma.feedback.create({
      data: {
        userId: req.user?.userId,
        userName,
        role: req.user?.role,
        message: data.message,
        contact: data.contact,
      },
    });
    res.status(201).json({ id: fb.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Не удалось сохранить обратную связь' });
  }
});

// GET /api/feedback — список для админа
feedbackRouter.get('/', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
  const items = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(items);
});

export default feedbackRouter;
