import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const apartmentsRouter = Router();
apartmentsRouter.use(authenticate);

// Validation schemas
const createApartmentSchema = z.object({
  number: z.string().min(1, 'Номер квартиры обязателен'),
  floor: z.number().int().positive('Этаж должен быть положительным числом'),
  rooms: z.number().int().positive('Количество комнат обязательно'),
  area: z.number().positive('Площадь обязательна'),
  price: z.number().positive('Цена обязательна'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).default('AVAILABLE'),
  layoutImage: z.string().optional(),
  projectId: z.string().min(1, 'ID проекта обязателен'),
});

const updateApartmentSchema = createApartmentSchema.partial().omit({ projectId: true });

// GET /api/apartments - список квартир с фильтрацией
apartmentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      projectId, 
      status, 
      rooms, 
      minPrice, 
      maxPrice,
      floor,
      page = '1', 
      limit = '50' 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Фильтр по проекту (обязательный для шахматки)
    if (projectId) {
      where.projectId = projectId;
    }

    // Фильтр по статусу
    if (status) {
      where.status = status;
    }

    // Фильтр по количеству комнат
    if (rooms) {
      where.rooms = parseInt(rooms as string);
    }

    // Фильтр по этажу
    if (floor) {
      where.floor = parseInt(floor as string);
    }

    // Фильтр по цене
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    const [apartments, total] = await Promise.all([
      prisma.apartment.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
            },
          },
          bookings: {
            where: {
              status: { in: ['PENDING', 'CONFIRMED'] },
            },
            select: {
              id: true,
              status: true,
              expiresAt: true,
              client: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: [
          { floor: 'asc' },
          { number: 'asc' },
        ],
      }),
      prisma.apartment.count({ where }),
    ]);

    res.json({
      apartments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get apartments error:', error);
    res.status(500).json({ error: 'Ошибка получения списка квартир' });
  }
});

// GET /api/apartments/:id - детали квартиры
apartmentsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const apartment = await prisma.apartment.findUnique({
      where: { id },
      include: {
        project: true,
        bookings: {
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
            broker: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!apartment) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }

    res.json(apartment);
  } catch (error) {
    console.error('Get apartment error:', error);
    res.status(500).json({ error: 'Ошибка получения квартиры' });
  }
});

// POST /api/apartments - создать квартиру (только застройщики и админы)
apartmentsRouter.post('/', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createApartmentSchema.parse(req.body);

    // Проверяем что проект существует
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Застройщики могут добавлять квартиры только в свои проекты
    if (req.user?.role === 'DEVELOPER' && project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Проверяем уникальность номера в проекте
    const existing = await prisma.apartment.findUnique({
      where: {
        projectId_number: {
          projectId: data.projectId,
          number: data.number,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Квартира с таким номером уже существует в этом проекте' });
      return;
    }

    const apartment = await prisma.apartment.create({
      data: data as any,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    res.status(201).json(apartment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create apartment error:', error);
    res.status(500).json({ error: 'Ошибка создания квартиры' });
  }
});

// POST /api/apartments/bulk - массовое создание квартир
apartmentsRouter.post('/bulk', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, apartments } = req.body;

    if (!projectId || !Array.isArray(apartments) || apartments.length === 0) {
      res.status(400).json({ error: 'Некорректные данные' });
      return;
    }

    // Проверяем проект
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    if (req.user?.role === 'DEVELOPER' && project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Создаем квартиры
    const created = await prisma.apartment.createMany({
      data: apartments.map((apt: any) => ({
        ...apt,
        projectId,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({ 
      message: `Создано ${created.count} квартир`,
      count: created.count,
    });
  } catch (error) {
    console.error('Bulk create apartments error:', error);
    res.status(500).json({ error: 'Ошибка массового создания квартир' });
  }
});

// PUT /api/apartments/:id - обновить квартиру
apartmentsRouter.put('/:id', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateApartmentSchema.parse(req.body);

    const existing = await prisma.apartment.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }

    if (req.user?.role === 'DEVELOPER' && existing.project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const apartment = await prisma.apartment.update({
      where: { id },
      data: data as any,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(apartment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Update apartment error:', error);
    res.status(500).json({ error: 'Ошибка обновления квартиры' });
  }
});

// DELETE /api/apartments/:id - удалить квартиру
apartmentsRouter.delete('/:id', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.apartment.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }

    if (req.user?.role === 'DEVELOPER' && existing.project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    await prisma.apartment.delete({
      where: { id },
    });

    res.json({ message: 'Квартира успешно удалена' });
  } catch (error) {
    console.error('Delete apartment error:', error);
    res.status(500).json({ error: 'Ошибка удаления квартиры' });
  }
});

// PUT /api/apartments/:id/status - изменить статус квартиры (для брокеров)
apartmentsRouter.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Валидация статуса
    if (!['AVAILABLE', 'RESERVED', 'SOLD'].includes(status)) {
      res.status(400).json({ error: 'Недопустимый статус. Используйте: AVAILABLE, RESERVED, SOLD' });
      return;
    }

    const existing = await prisma.apartment.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }

    const apartment = await prisma.apartment.update({
      where: { id },
      data: { status },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    res.json(apartment);
  } catch (error) {
    console.error('Update apartment status error:', error);
    res.status(500).json({ error: 'Ошибка обновления статуса квартиры' });
  }
});


// POST /api/apartments/import - bulk import apartments from JSON (parsed from Excel on frontend)
apartmentsRouter.post('/import', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, apartments } = req.body;

    if (!projectId || !Array.isArray(apartments) || apartments.length === 0) {
      res.status(400).json({ error: 'projectId и массив apartments обязательны' });
      return;
    }

    // Verify project belongs to developer
    if (req.user?.role === 'DEVELOPER') {
      const project = await prisma.project.findFirst({
        where: { id: projectId, developerId: req.user.userId },
      });
      if (!project) {
        res.status(403).json({ error: 'Нет доступа к этому проекту' });
        return;
      }
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const apt of apartments) {
      try {
        const number = String(apt.number || apt['Номер'] || '').trim();
        const floor = parseInt(apt.floor || apt['Этаж']);
        const rooms = parseInt(apt.rooms || apt['Комнат']);
        const area = parseFloat(apt.area || apt['Площадь']);
        const price = parseFloat(apt.price || apt['Цена']);

        if (!number || isNaN(floor) || isNaN(rooms) || isNaN(area) || isNaN(price)) {
          results.errors.push(`Пропущена квартира: невалидные данные (${number || 'без номера'})`);
          results.skipped++;
          continue;
        }

        await prisma.apartment.upsert({
          where: { projectId_number: { projectId, number } },
          update: { floor, rooms, area, price, status: 'AVAILABLE' },
          create: { projectId, number, floor, rooms, area, price, status: 'AVAILABLE' },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`Ошибка: ${e.message}`);
        results.skipped++;
      }
    }

    res.json({ message: `Импортировано: ${results.created}, пропущено: ${results.skipped}`, ...results });
  } catch (error) {
    console.error('Import apartments error:', error);
    res.status(500).json({ error: 'Ошибка импорта квартир' });
  }
});
