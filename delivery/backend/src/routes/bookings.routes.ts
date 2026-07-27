import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { BookingStatus } from '@prisma/client';

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

// Validation schemas
const createBookingSchema = z.object({
  clientId: z.string().min(1, 'ID клиента обязателен'),
  apartmentId: z.string().min(1, 'ID квартиры обязателен'),
  expiresAt: z.string().optional(), // ISO date string, default 24 hours
  notes: z.string().optional(),
});

const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/bookings - список бронирований с фильтрацией
bookingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      clientId,
      apartmentId,
      projectId,
      brokerId,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Фильтр по статусу
    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status as BookingStatus[] };
      } else {
        where.status = status as BookingStatus;
      }
    }

    // Фильтр по клиенту
    if (clientId) {
      where.clientId = clientId;
    }

    // Фильтр по квартире
    if (apartmentId) {
      where.apartmentId = apartmentId;
    }

    // Фильтр по проекту (через квартиру)
    if (projectId) {
      where.apartment = {
        projectId: projectId,
      };
    }

    // Брокеры видят только свои брони
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '')) {
      where.brokerId = req.user!.userId;
    } else if (brokerId) {
      where.brokerId = brokerId;
    }

    // Девелоперы видят брони только на свои квартиры
    if (req.user?.role === 'DEVELOPER') {
      where.apartment = {
        ...where.apartment,
        project: {
          developerId: req.user.userId,
        },
      };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limitNum,
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
          apartment: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  address: true,
                },
              },
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
      }),
      prisma.booking.count({ where }),
    ]);

    // Проверяем истекшие брони
    const now = new Date();
    const expiredBookings = bookings.filter(
      (b) => b.status === 'PENDING' && b.expiresAt < now
    );

    // Автоматически обновляем истекшие брони
    if (expiredBookings.length > 0) {
      await Promise.all(
        expiredBookings.map((booking) =>
          prisma.$transaction([
            prisma.booking.update({
              where: { id: booking.id },
              data: { status: 'EXPIRED' },
            }),
            prisma.apartment.update({
              where: { id: booking.apartmentId },
              data: { status: 'AVAILABLE' },
            }),
          ])
        )
      );
    }

    res.json({
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Ошибка получения списка бронирований' });
  }
});

// GET /api/bookings/:id - детали бронирования
bookingsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
        apartment: {
          include: {
            project: true,
          },
        },
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ error: 'Бронирование не найдено' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && booking.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Проверяем истечение
    if (booking.status === 'PENDING' && booking.expiresAt < new Date()) {
      // Автоматически обновляем статус
      await prisma.$transaction([
        prisma.booking.update({
          where: { id },
          data: { status: 'EXPIRED' },
        }),
        prisma.apartment.update({
          where: { id: booking.apartmentId },
          data: { status: 'AVAILABLE' },
        }),
      ]);
      booking.status = 'EXPIRED';
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Ошибка получения бронирования' });
  }
});

// POST /api/bookings - создать бронирование
bookingsRouter.post('/', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createBookingSchema.parse(req.body);

    // Проверяем квартиру
    const apartment = await prisma.apartment.findUnique({
      where: { id: data.apartmentId },
    });

    if (!apartment) {
      res.status(404).json({ error: 'Квартира не найдена' });
      return;
    }

    if (apartment.status !== 'AVAILABLE') {
      res.status(400).json({ error: 'Квартира недоступна для бронирования' });
      return;
    }

    // Проверяем клиента
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    });

    if (!client) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    // Для ограниченных ролей - проверяем что это их клиент
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Это не ваш клиент' });
      return;
    }

    // Проверяем нет ли уже активной брони на эту квартиру
    const existingBooking = await prisma.booking.findFirst({
      where: {
        apartmentId: data.apartmentId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (existingBooking) {
      res.status(400).json({ error: 'На эту квартиру уже есть активное бронирование' });
      return;
    }

    // Устанавливаем срок истечения (по умолчанию 24 часа)
    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 часа

    // Создаем бронирование и обновляем статус квартиры в транзакции
    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          clientId: data.clientId,
          apartmentId: data.apartmentId,
          brokerId: req.user!.userId,
          expiresAt,
          notes: data.notes,
          status: 'PENDING',
        },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          apartment: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  developerId: true,
                },
              },
            },
          },
          broker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      prisma.apartment.update({
        where: { id: data.apartmentId },
        data: { status: 'RESERVED' },
      }),
    ]);

    // Отправляем уведомление застройщику о новой брони
    if (booking.apartment.project.developerId) {
      await prisma.notification.create({
        data: {
          userId: booking.apartment.project.developerId,
          type: 'SYSTEM',
          title: 'Новая бронь',
          message: `Брокер ${booking.broker.firstName} ${booking.broker.lastName} забронировал квартиру №${apartment.number} в ЖК "${booking.apartment.project.name}". Тел: ${booking.broker.phone || 'не указан'}`,
        },
      });
    }

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Ошибка создания бронирования' });
  }
});

// PUT /api/bookings/:id - обновить бронирование (подтвердить/отменить)
bookingsRouter.put('/:id', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateBookingSchema.parse(req.body);

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Бронирование не найдено' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Определяем новый статус квартиры
    let apartmentStatus = existing.apartment.status;
    if (data.status) {
      if (data.status === 'CONFIRMED') {
        apartmentStatus = 'RESERVED';
      } else if (data.status === 'CANCELLED' || data.status === 'EXPIRED') {
        apartmentStatus = 'AVAILABLE';
      }
    }

    // Обновляем бронирование и квартиру в транзакции
    const [booking] = await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: {
          status: data.status,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          notes: data.notes,
        } as any,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          apartment: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          broker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.apartment.update({
        where: { id: existing.apartmentId },
        data: { status: apartmentStatus as any },
      }),
    ]);

    res.json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
      return;
    }
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Ошибка обновления бронирования' });
  }
});

// DELETE /api/bookings/:id - удалить бронирование
bookingsRouter.delete('/:id', requireRole('BROKER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Бронирование не найдено' });
      return;
    }

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Удаляем бронирование и освобождаем квартиру
    await prisma.$transaction([
      prisma.booking.delete({
        where: { id },
      }),
      prisma.apartment.update({
        where: { id: existing.apartmentId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    res.json({ message: 'Бронирование успешно удалено' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Ошибка удаления бронирования' });
  }
});

// POST /api/bookings/:id/complete-deal - оформить продажу (финализировать сделку)
bookingsRouter.post('/:id/complete-deal', requireRole('BROKER', 'ADMIN', 'DEVELOPER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('Complete deal request for booking:', id);
    console.log('User:', req.user);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
        apartment: true,
      },
    });

    if (!booking) {
      console.log('Booking not found:', id);
      res.status(404).json({ error: 'Бронирование не найдено' });
      return;
    }

    console.log('Booking found:', booking.id, 'Status:', booking.status);

    // Проверка прав доступа
    const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
    if (restrictedRoles.includes(req.user?.role || '') && booking.brokerId !== req.user!.userId) {
      console.log('Access denied: user mismatch');
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }

    // Можно финализировать только подтвержденные брони
    if (booking.status !== 'CONFIRMED') {
      console.log('Cannot complete deal: status is', booking.status);
      res.status(400).json({
        error: `Можно оформить продажу только для подтвержденного бронирования. Текущий статус: ${booking.status}`
      });
      return;
    }

    console.log('Starting transaction to complete deal...');

    // Финализируем сделку в транзакции:
    // 1. Квартира → SOLD
    // 2. Клиент → DEAL_CLOSED
    // 3. Бронь → COMPLETED
    await prisma.$transaction([
      // Обновляем статус квартиры
      prisma.apartment.update({
        where: { id: booking.apartmentId },
        data: { status: 'SOLD' },
      }),
      // Обновляем статус клиента
      prisma.client.update({
        where: { id: booking.clientId },
        data: { status: 'DEAL_CLOSED' },
      }),
      // Обновляем статус бронирования
      prisma.booking.update({
        where: { id },
        data: { status: 'COMPLETED' },
      }),
    ]);

    console.log('Transaction completed successfully');

    // Получаем обновленное бронирование с новыми данными
    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        apartment: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        broker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log('Deal completed! Apartment status:', updatedBooking?.apartment.status);
    console.log('Client status:', updatedBooking?.client.status);

    res.json({
      message: 'Сделка успешно оформлена! Квартира продана.',
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Complete deal error:', error);
    res.status(500).json({ error: 'Ошибка оформления продажи', details: String(error) });
  }
});
