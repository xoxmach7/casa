import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const propertiesRouter = Router();
propertiesRouter.use(authenticate);

// Validation schemas
const createPropertySchema = z.object({
  title: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND']),
  city: z.string().min(1, 'Город обязателен'),
  district: z.string().optional(),
  address: z.string().min(1, 'Адрес обязателен'),
  floor: z.number().optional(),
  totalFloors: z.number().optional(),
  rooms: z.number().optional(),
  area: z.number().positive('Площадь должна быть положительной'),
  price: z.number().positive('Цена должна быть положительной'),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  yearBuilt: z.number().optional(),
  condition: z.string().optional(),
  features: z.array(z.string()).optional(),
  notes: z.string().optional(),
  sellerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'SOLD', 'RESERVED', 'ARCHIVED']).optional(),
});

const updatePropertySchema = createPropertySchema.partial();

// GET /api/properties - список объектов вторички с фильтрацией
propertiesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      propertyType,
      city,
      district,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      rooms,
      search,
      page = '1',
      limit = '12',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Фильтр по статусу
    if (status) {
      where.status = status;
    }

    // Фильтр по типу недвижимости
    if (propertyType) {
      where.propertyType = propertyType;
    }

    // Фильтр по городу
    if (city) {
      where.city = city;
    }

    // Фильтр по району
    if (district) {
      where.district = district;
    }

    // Фильтр по цене
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    // Фильтр по площади
    if (minArea || maxArea) {
      where.area = {};
      if (minArea) where.area.gte = parseFloat(minArea as string);
      if (maxArea) where.area.lte = parseFloat(maxArea as string);
    }

    // Фильтр по комнатам
    if (rooms) {
      where.rooms = parseInt(rooms as string);
    }

    // Поиск
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Брокеры, Риелторы и Агентства видят только свои объекты
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) {
      where.brokerId = req.user!.userId;
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          broker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          seller: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          buyer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

// GET /api/properties/:id - детали объекта
propertiesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    // Проверка прав доступа для ограниченных ролей
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    res.json(property);
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Ошибка получения объекта' });
  }
});

// POST /api/properties - создать объект
propertiesRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createPropertySchema.parse(req.body);

    // Remove empty sellerId to avoid foreign key violation
    if (!validatedData.sellerId) {
      delete validatedData.sellerId;
    }

    const property = await prisma.property.create({
      data: {
        ...validatedData,
        brokerId: req.user!.userId,
      },
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Ошибка создания объекта' });
  }
});

// PUT /api/properties/:id - обновить объект
propertiesRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updatePropertySchema.parse(req.body);

    // Проверка, что объект принадлежит брокеру
    const existingProperty = await prisma.property.findUnique({
      where: { id },
    });

    if (!existingProperty) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (
      restrictedRoles.includes(req.user?.role || '') &&
      existingProperty.brokerId !== req.user!.userId
    ) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const property = await prisma.property.update({
      where: { id },
      data: validatedData,
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        seller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Ошибка обновления объекта' });
  }
});

// DELETE /api/properties/:id - удалить объект
propertiesRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Проверка, что объект принадлежит брокеру
    const existingProperty = await prisma.property.findUnique({
      where: { id },
    });

    if (!existingProperty) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (
      restrictedRoles.includes(req.user?.role || '') &&
      existingProperty.brokerId !== req.user!.userId
    ) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    await prisma.property.delete({
      where: { id },
    });

    res.json({ message: 'Объект удален' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Ошибка удаления объекта' });
  }
});

// POST /api/properties/:id/assign-buyer - назначить покупателя
propertiesRouter.post('/:id/assign-buyer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { buyerId } = req.body;

    // Проверка существования объекта
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Проверка существования покупателя
    const buyer = await prisma.client.findUnique({
      where: { id: buyerId },
    });

    if (!buyer) {
      res.status(404).json({ error: 'Покупатель не найден' });
      return;
    }

    // Назначение покупателя и изменение статуса
    const updated = await prisma.property.update({
      where: { id },
      data: {
        buyerId,
        status: 'RESERVED',
      },
      include: {
        broker: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        seller: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        buyer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Assign buyer error:', error);
    res.status(500).json({ error: 'Ошибка назначения покупателя' });
  }
});

// POST /api/properties/:id/unassign-buyer - снять покупателя
propertiesRouter.post('/:id/unassign-buyer', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && property.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const updated = await prisma.property.update({
      where: { id },
      data: {
        buyerId: null,
        status: 'ACTIVE',
      },
      include: {
        broker: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        seller: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Unassign buyer error:', error);
    res.status(500).json({ error: 'Ошибка снятия покупателя' });
  }
});

// GET /api/properties/stats/overview - общая статистика по объектам
propertiesRouter.get('/stats/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const where: any = {};

    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) {
      where.brokerId = req.user!.userId;
    }

    const [total, active, sold, reserved] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.count({ where: { ...where, status: 'AVAILABLE' } }),
      prisma.property.count({ where: { ...where, status: 'SOLD' } }),
      prisma.property.count({ where: { ...where, status: 'RESERVED' } }),
    ]);

    res.json({
      total,
      available: active,
      sold,
      reserved,
    });
  } catch (error) {
    console.error('Get properties stats error:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});
