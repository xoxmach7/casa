import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const buildingsRouter = Router();
buildingsRouter.use(authenticate);

const createBuildingSchema = z.object({
  name: z.string().min(1, 'Название здания обязательно'),
  projectId: z.string().min(1, 'ID проекта обязателен'),
});

// GET /api/buildings?projectId=X
buildingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = projectId;

    const buildings = await prisma.building.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(buildings);
  } catch (error) {
    console.error('Get buildings error:', error);
    res.status(500).json({ error: 'Ошибка получения списка зданий' });
  }
});

// POST /api/buildings - создать здание (только застройщики и админы)
buildingsRouter.post('/', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createBuildingSchema.parse(req.body);

    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    if (req.user?.role === 'DEVELOPER' && project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const building = await prisma.building.create({ data });

    res.status(201).json(building);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create building error:', error);
    res.status(500).json({ error: 'Ошибка создания здания' });
  }
});
