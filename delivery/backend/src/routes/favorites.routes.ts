// =========================================
// FAVORITES ROUTES
// Личное «быстрое избранное» — закладки брокера на квартиры без привязки к
// клиенту (в отличие от Selection, которая всегда принадлежит клиенту).
// Всё строго в рамках текущего пользователя (req.user.userId).
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';

export const favoritesRouter = Router();
favoritesRouter.use(authenticate);

const addFavoriteSchema = z.object({
  apartmentId: z.string().min(1),
});

// GET /api/favorites — избранное текущего пользователя
favoritesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        apartment: {
          include: {
            project: { select: { id: true, name: true, city: true, address: true } },
          },
        },
      },
    });
    res.json(favorites);
  } catch (error) {
    console.error('List favorites error:', error);
    res.status(500).json({ error: 'Ошибка получения избранного' });
  }
});

// POST /api/favorites — добавить квартиру в избранное (идемпотентно)
favoritesRouter.post('/', validate(addFavoriteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { apartmentId } = req.body;
    const apartment = await prisma.apartment.findUnique({ where: { id: apartmentId } });
    if (!apartment) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }
    const favorite = await prisma.favorite.upsert({
      where: { userId_apartmentId: { userId: req.user!.userId, apartmentId } },
      update: {},
      create: { userId: req.user!.userId, apartmentId },
    });
    res.status(201).json(favorite);
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Ошибка добавления в избранное' });
  }
});

// DELETE /api/favorites/:apartmentId — убрать из избранного
favoritesRouter.delete('/:apartmentId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user!.userId, apartmentId: req.params.apartmentId },
    });
    res.status(204).end();
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: 'Ошибка удаления из избранного' });
  }
});
