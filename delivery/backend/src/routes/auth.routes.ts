import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { z } from 'zod';
import { auth } from '../middleware/auth.middleware';

export const authRouter = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const profileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Login attempt for:', req.body.email);
    const { email, password } = loginSchema.parse(req.body);

    console.log('Searching for user:', email);
    // Найти пользователя
    const user = await prisma.user.findUnique({
      where: { email },
    });
    console.log('User found:', !!user);

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Неверные учетные данные' });
      return;
    }

    // Проверить пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Неверные учетные данные' });
      return;
    }

    // Генерировать токен
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Отправить данные пользователя без пароля
    const { password: _, ...userWithoutPassword } = user;

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({
      token, // kept for backward compatibility during migration
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    res.status(500).json({
      error: 'Ошибка сервера',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/auth/me - получить текущего пользователя
authRouter.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        balance: true,
        // Fetch denormalized fields (legacy/cache)
        curatorName: true,
        curatorPhone: true,
        curatorEmail: true,
        curatorWhatsApp: true,
        createdAt: true,
        // Fetch actual relation to ensure data is up-to-date
        curator: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          }
        }
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Determine curator info (prefer denormalized if set, else fallback to relation)
    // Actually, relation is truth.
    const curatorName = user.curatorName || (user.curator ? `${user.curator.firstName} ${user.curator.lastName}` : null);
    const curatorEmail = user.curatorEmail || user.curator?.email || null;
    const curatorPhone = user.curatorPhone || user.curator?.phone || null;
    const curatorWhatsApp = user.curatorWhatsApp || user.curator?.phone || null;

    res.json({
      ...user,
      balance: Number(user.balance),
      curatorName,
      curatorEmail,
      curatorPhone,
      curatorWhatsApp,

      // Remove the curator object from response to keep it clean if needed, 
      // but keeping it doesn't hurt.
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/auth/profile - обновить профиль
authRouter.put('/profile', auth, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone } = profileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/auth/change-password - изменить пароль
authRouter.put('/change-password', auth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Заполните все поля' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(400).json({ error: 'Неверный текущий пароль' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// POST /api/auth/logout - выход
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Вы вышли из системы' });
});

// GET /api/auth/check - проверка авторизации (cookie-based)
authRouter.get('/check', auth, (_req: Request, res: Response) => {
  res.json({ authenticated: true, user: _req.user });
});
