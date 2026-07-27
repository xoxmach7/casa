import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const usersRouter = Router();

// Схемы валидации
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// ==== Эндпоинты для текущего пользователя (требуют только аутентификации) ====

// GET /api/users/me - получить данные текущего пользователя
usersRouter.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/users/me - обновить профиль текущего пользователя
usersRouter.put('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Некорректные данные', errors: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Ошибка при обновлении профиля' });
  }
});

// PUT /api/users/me/password - сменить пароль
usersRouter.put('/me/password', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Получить текущего пользователя с паролем
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }

    // Проверить текущий пароль
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      res.status(400).json({ message: 'Неверный текущий пароль' });
      return;
    }

    // Хэшировать новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Обновить пароль
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Пароль успешно изменён' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Некорректные данные', errors: error.errors });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Ошибка при смене пароля' });
  }
});

// GET /api/users/me/stats - статистика пользователя
usersRouter.get('/me/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [clients, deals, bookings] = await Promise.all([
      prisma.client.count({ where: { brokerId: userId } }),
      prisma.deal.count({ where: { brokerId: userId } }),
      prisma.booking.count({ where: { brokerId: userId } }),
    ]);

    res.json({ clients, deals, bookings });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// ==== Эндпоинты для администраторов ====

// Все роуты ниже требуют аутентификации и роли ADMIN
const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

// GET /api/users - список пользователей
adminRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, search, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          city: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/users - создать пользователя
adminRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, city, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        city,
        role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Ошибка при создании пользователя' });
  }
});

usersRouter.use('/', adminRouter);
