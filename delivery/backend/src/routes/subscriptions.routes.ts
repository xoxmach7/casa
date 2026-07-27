import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticate);

// GET /api/subscriptions/my - текущая подписка пользователя
subscriptionsRouter.get('/my', async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sub || { plan: 'FREE', status: 'ACTIVE' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения подписки' });
  }
});

// POST /api/subscriptions - создать/обновить подписку (ADMIN)
subscriptionsRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, plan, expiresAt, amount } = req.body;
    if (!userId || !plan) {
      res.status(400).json({ error: 'userId и plan обязательны' });
      return;
    }

    // Деактивируем старые подписки
    await prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });

    const sub = await prisma.subscription.create({
      data: {
        userId,
        plan,
        status: 'ACTIVE',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        amount: amount || null,
      },
    });

    res.status(201).json(sub);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания подписки' });
  }
});

// GET /api/subscriptions - все подписки (ADMIN)
subscriptionsRouter.get('/', requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const subs = await prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
    });
    res.json(subs);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});
