import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';

// Управление застройщиками (ADMIN only): очередь заявок на само­регистрацию и
// одобрение/отклонение. «Застройщик» — это User с ролью DEVELOPER; заявка
// приходит в статусе PENDING (см. auth.routes.ts /register-developer).
export const developersRouter = Router();

developersRouter.use(authenticate);
developersRouter.use(requireRole('ADMIN'));

const DEVELOPER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  isActive: true,
  companyName: true,
  bin: true,
  companyPhone: true,
  companyWebsite: true,
  companyDescription: true,
  companyLogo: true,
  createdAt: true,
  _count: { select: { projects: true } },
} as const;

// GET /api/admin/developers?status=PENDING|ACTIVE|REJECTED — список застройщиков.
developersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where: any = { role: 'DEVELOPER' };
    if (status && ['ACTIVE', 'PENDING', 'REJECTED'].includes(status as string)) {
      where.status = status as string;
    }

    const developers = await prisma.user.findMany({
      where,
      select: DEVELOPER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    res.json(developers);
  } catch (error) {
    console.error('List developers error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/developers/:id/approve — одобрить заявку застройщика.
developersRouter.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const dev = await prisma.user.findFirst({ where: { id, role: 'DEVELOPER' } });
    if (!dev) {
      res.status(404).json({ error: 'Застройщик не найден' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
      select: DEVELOPER_SELECT,
    });

    await prisma.notification.create({
      data: {
        userId: id,
        type: 'SYSTEM',
        title: 'Заявка одобрена',
        message: 'Ваша заявка застройщика одобрена. Теперь вы можете войти и добавлять свои ЖК.',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Approve developer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/developers/:id/reject — отклонить заявку застройщика.
developersRouter.post('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const dev = await prisma.user.findFirst({ where: { id, role: 'DEVELOPER' } });
    if (!dev) {
      res.status(404).json({ error: 'Застройщик не найден' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'REJECTED', isActive: false },
      select: DEVELOPER_SELECT,
    });

    await prisma.notification.create({
      data: {
        userId: id,
        type: 'SYSTEM',
        title: 'Заявка отклонена',
        message: 'Ваша заявка застройщика отклонена. Свяжитесь с администратором для уточнения.',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Reject developer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
