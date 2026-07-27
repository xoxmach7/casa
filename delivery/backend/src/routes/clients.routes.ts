import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const clientsRouter = Router();
clientsRouter.use(authenticate);

// Validation schemas
const createClientSchema = z.object({
  iin: z.string().length(12, 'ИИН должен содержать 12 цифр'),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  middleName: z.string().optional(),
  phone: z.string().min(10, 'Телефон обязателен'),
  email: z.string().email('Неверный email').optional(),
  clientType: z.enum(['BUYER', 'SELLER', 'NEW_BUILDING']).optional(),
  budget: z.number().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['NEW', 'IN_PROGRESS', 'DEAL_CLOSED', 'REJECTED']).default('NEW'),
  monthlyIncome: z.number().optional(),
  initialPayment: z.number().optional(),
});

const updateClientSchema = createClientSchema.partial();

// GET /api/clients - список клиентов с расширенной фильтрацией
clientsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      clientType,
      city,
      search,
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Фильтр по статусу
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Фильтр по типу клиента
    if (clientType && clientType !== 'ALL') {
      where.clientType = clientType;
    }

    // Фильтр по городу
    if (city && city !== 'ALL') {
      where.city = city;
    }

    // Поиск по имени, фамилии, ИИН или телефону
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { middleName: { contains: search as string, mode: 'insensitive' } },
        { iin: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Фильтр по брокеру (брокеры, риелторы и агентства видят только своих клиентов)
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) {
      where.brokerId = req.user!.userId;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          broker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              mortgageCalculations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      clients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Ошибка получения списка клиентов' });
  }
});

// GET /api/clients/:id - детали клиента
clientsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        bookings: {
          include: {
            apartment: {
              include: {
                project: true,
              },
            },
          },
        },
        documents: true,
        mortgageCalculations: true,
        sellingProperties: {
          select: {
            id: true,
            title: true,
            propertyType: true,
            address: true,
            price: true,
            status: true,
            images: true,
          },
        },
        boughtProperties: {
          select: {
            id: true,
            title: true,
            propertyType: true,
            address: true,
            price: true,
            status: true,
            images: true,
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Ошибка получения клиента' });
  }
});

// POST /api/clients - создать клиента
clientsRouter.post('/', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createClientSchema.parse(req.body);

    // Проверка уникальности ИИН
    const existing = await prisma.client.findUnique({
      where: { iin: data.iin },
    });

    if (existing) {
      res.status(400).json({ error: 'Клиент с таким ИИН уже существует' });
      return;
    }

    // Создаем клиента
    const client = await prisma.client.create({
      data: {
        ...data,
        brokerId: req.user!.userId,
      },
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Ошибка создания клиента' });
  }
});

// PUT /api/clients/:id - обновить клиента
clientsRouter.put('/:id', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateClientSchema.parse(req.body);

    // Проверка существования
    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Проверка уникальности ИИН (если меняется)
    if (data.iin && data.iin !== existing.iin) {
      const iinExists = await prisma.client.findUnique({
        where: { iin: data.iin },
      });
      if (iinExists) {
        res.status(400).json({ error: 'Клиент с таким ИИН уже существует' });
        return;
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: data as any,
      include: {
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Ошибка обновления клиента' });
  }
});

// DELETE /api/clients/:id - удалить клиента
clientsRouter.delete('/:id', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.client.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    await prisma.client.delete({
      where: { id },
    });

    res.json({ message: 'Клиент успешно удален' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Ошибка удаления клиента' });
  }
});

// POST /api/clients/:id/link-property - привязать объект к клиенту
clientsRouter.post('/:id/link-property', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { propertyId, role } = req.body; // role: 'seller' | 'buyer'

    if (!propertyId || !role || !['seller', 'buyer'].includes(role)) {
      res.status(400).json({ error: 'Неверные параметры. Укажите propertyId и role (seller/buyer)' });
      return;
    }

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    const updateData = role === 'seller' ? { sellerId: id } : { buyerId: id };

    await prisma.property.update({
      where: { id: propertyId },
      data: updateData,
    });

    res.json({ message: `Клиент успешно привязан к объекту как ${role === 'seller' ? 'продавец' : 'покупатель'}` });
  } catch (error) {
    console.error('Link property error:', error);
    res.status(500).json({ error: 'Ошибка привязки объекта' });
  }
});

// DELETE /api/clients/:id/unlink-property - отвязать объект от клиента
clientsRouter.delete('/:id/unlink-property', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { propertyId, role } = req.body;

    if (!propertyId || !role || !['seller', 'buyer'].includes(role)) {
      res.status(400).json({ error: 'Неверные параметры' });
      return;
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const updateData = role === 'seller' ? { sellerId: null } : { buyerId: null };

    await prisma.property.update({
      where: { id: propertyId },
      data: updateData,
    });

    res.json({ message: 'Объект успешно отвязан от клиента' });
  } catch (error) {
    console.error('Unlink property error:', error);
    res.status(500).json({ error: 'Ошибка отвязки объекта' });
  }
});
