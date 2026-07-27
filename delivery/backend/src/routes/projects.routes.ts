import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  city: z.string().min(1, 'Город обязателен'),
  district: z.string().optional(),
  address: z.string().min(1, 'Адрес обязателен'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  class: z.string().optional(),
  buildingStatus: z.enum(['UNDER_CONSTRUCTION', 'COMPLETED', 'READY_TO_MOVE']).optional(),
  deliveryDate: z.string().optional(),
  developerName: z.string().optional(),
  developerPhone: z.string().optional(),
  crmUrl: z.string().optional(),
  bonus: z.string().optional(),
  promotions: z.string().optional(),
  mortgagePrograms: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// GET /api/projects - список ЖК с расширенной фильтрацией
projectsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      city, 
      district, 
      buildingStatus, 
      class: projectClass,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      rooms,
      search, 
      page = '1', 
      limit = '12' 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Фильтр по городу
    if (city) {
      where.city = city;
    }

    // Фильтр по району
    if (district) {
      where.district = district;
    }

    // Фильтр по статусу строительства
    if (buildingStatus) {
      where.buildingStatus = buildingStatus;
    }

    // Фильтр по классу жилья
    if (projectClass) {
      where.class = projectClass;
    }

    // Поиск по названию или адресу
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { developerName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Застройщики видят только свои проекты
    if (req.user?.role === 'DEVELOPER') {
      where.developerId = req.user.userId;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          developer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              apartments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    // Получаем статистику по квартирам для каждого проекта
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        // Условия фильтрации квартир
        const apartmentWhere: any = { projectId: project.id };

        // Фильтр по цене квартир
        if (minPrice || maxPrice) {
          apartmentWhere.price = {};
          if (minPrice) apartmentWhere.price.gte = parseFloat(minPrice as string);
          if (maxPrice) apartmentWhere.price.lte = parseFloat(maxPrice as string);
        }

        // Фильтр по площади
        if (minArea || maxArea) {
          apartmentWhere.area = {};
          if (minArea) apartmentWhere.area.gte = parseFloat(minArea as string);
          if (maxArea) apartmentWhere.area.lte = parseFloat(maxArea as string);
        }

        // Фильтр по комнатам
        if (rooms) {
          apartmentWhere.rooms = parseInt(rooms as string);
        }

        const apartmentStats = await prisma.apartment.groupBy({
          by: ['status'],
          where: apartmentWhere,
          _count: true,
        });

        // Получаем минимальную цену среди доступных квартир
        const minPriceApt = await prisma.apartment.findFirst({
          where: { projectId: project.id, status: 'AVAILABLE' },
          orderBy: { price: 'asc' },
          select: { price: true },
        });

        const stats = {
          total: project._count.apartments,
          available: apartmentStats.find((s) => s.status === 'AVAILABLE')?._count || 0,
          reserved: apartmentStats.find((s) => s.status === 'RESERVED')?._count || 0,
          sold: apartmentStats.find((s) => s.status === 'SOLD')?._count || 0,
          minPrice: minPriceApt?.price || null,
        };

        return {
          ...project,
          apartmentStats: stats,
        };
      })
    );

    res.json({
      projects: projectsWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Ошибка получения списка проектов' });
  }
});

// GET /api/projects/:id - детали проекта
projectsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        developer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        apartments: {
          orderBy: [
            { floor: 'asc' },
            { number: 'asc' },
          ],
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Проверка прав доступа для застройщиков
    if (req.user?.role === 'DEVELOPER' && project.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Статистика по квартирам
    const apartmentStats = await prisma.apartment.groupBy({
      by: ['status'],
      where: { projectId: id },
      _count: true,
    });

    const stats = {
      total: project.apartments.length,
      available: apartmentStats.find((s) => s.status === 'AVAILABLE')?._count || 0,
      reserved: apartmentStats.find((s) => s.status === 'RESERVED')?._count || 0,
      sold: apartmentStats.find((s) => s.status === 'SOLD')?._count || 0,
    };

    res.json({
      ...project,
      apartmentStats: stats,
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Ошибка получения проекта' });
  }
});

// POST /api/projects - создать ЖК (только для застройщиков и админов)
projectsRouter.post('/', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createProjectSchema.parse(req.body);

    // Для застройщиков автоматически присваиваем их ID
    // Для админов можно указать developerId в body или использовать свой
    let developerId = req.user!.userId;
    if (req.user!.role === 'ADMIN' && req.body.developerId) {
      developerId = req.body.developerId;
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        city: data.city,
        district: data.district,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        class: data.class,
        buildingStatus: data.buildingStatus,
        developerName: data.developerName,
        developerPhone: data.developerPhone,
        crmUrl: data.crmUrl,
        bonus: data.bonus,
        promotions: data.promotions,
        mortgagePrograms: data.mortgagePrograms || [],
        videoUrl: data.videoUrl,
        deliveryDate: data.deliveryDate ? (() => { const d = new Date(data.deliveryDate); return d.getFullYear() > 1900 && d.getFullYear() < 2100 ? d : undefined; })() : undefined,
        images: data.images || [],
        developerId,
      },
      include: {
        developer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Ошибка создания проекта' });
  }
});

// PUT /api/projects/:id - обновить проект
projectsRouter.put('/:id', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    // Проверка существования
    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Проверка прав доступа для застройщиков
    if (req.user?.role === 'DEVELOPER' && existing.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        deliveryDate: data.deliveryDate ? (() => { const d = new Date(data.deliveryDate); return d.getFullYear() > 1900 && d.getFullYear() < 2100 ? d : undefined; })() : undefined,
      } as any,
      include: {
        developer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Ошибка обновления проекта' });
  }
});

// DELETE /api/projects/:id - удалить проект
projectsRouter.delete('/:id', requireRole('DEVELOPER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Проект не найден' });
      return;
    }

    // Проверка прав доступа для застройщиков
    if (req.user?.role === 'DEVELOPER' && existing.developerId !== req.user.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Проект успешно удален' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Ошибка удаления проекта' });
  }
});
