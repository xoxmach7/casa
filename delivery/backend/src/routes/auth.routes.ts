import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { z } from 'zod';
import { auth, requireRole } from '../middleware/auth.middleware';

export const authRouter = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Само­регистрация застройщика: заводит User(role=DEVELOPER) в статусе PENDING.
const registerDeveloperSchema = z.object({
  companyName: z.string().min(2).max(200),
  bin: z.string().min(3).max(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(5).max(30),
  password: z.string().min(6),
});

const developerProfileSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  bin: z.string().max(20).optional().nullable(),
  companyPhone: z.string().max(30).optional().nullable(),
  companyLogo: z.string().max(1000).optional().nullable(),
  companyWebsite: z.string().max(200).optional().nullable(),
  companyDescription: z.string().max(2000).optional().nullable(),
});

const profileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Найти пользователя
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Неверные учетные данные' });
      return;
    }

    // Гейт застройщика на модерации: даём понятный текст вместо «неверные данные».
    if (user.status === 'PENDING') {
      res.status(403).json({ error: 'Ваша заявка застройщика на рассмотрении. Дождитесь одобрения администратором.' });
      return;
    }
    if (user.status === 'REJECTED') {
      res.status(403).json({ error: 'Заявка застройщика отклонена. Свяжитесь с администратором.' });
      return;
    }
    if (!user.isActive) {
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

    // Сессия живёт ТОЛЬКО в httpOnly-cookie — из JS её не прочитать, поэтому
    // XSS не может украсть токен (см. docs/SECURITY-AUDIT-2026-08-10.md, M-3).
    // SameSite=None обязателен: фронт (crm) и API — разные сайты (*.up.railway.app),
    // и без None браузер cookie на API не пошлёт. None требует Secure, поэтому
    // secure=true в проде; в dev (localhost, http) — lax/secure=false. CSRF,
    // который открывает None, закрыт csrfGuard по Origin.
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Токен в теле НЕ возвращаем: единственный его дом — cookie выше. Фронт
    // берёт личность из объекта user (роль/имя — не секрет) и полагается на
    // cookie для авторизации запросов.
    res.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    // Наружу — только общий текст. Раньше здесь возвращался error.message, что
    // могло протечь внутреннюю деталь клиенту (LOW-4). Детали — в лог выше.
    res.status(500).json({ error: 'Ошибка сервера' });
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
        // Профиль компании-застройщика (nullable для остальных ролей)
        companyName: true,
        bin: true,
        companyPhone: true,
        companyLogo: true,
        companyWebsite: true,
        companyDescription: true,
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
  // Атрибуты обязаны совпадать с теми, что при установке, иначе браузер не
  // сматчит и не удалит кросс-сайтовую cookie.
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
  res.json({ message: 'Вы вышли из системы' });
});

// GET /api/auth/check - проверка авторизации (cookie-based)
authRouter.get('/check', auth, (_req: Request, res: Response) => {
  res.json({ authenticated: true, user: _req.user });
});

// POST /api/auth/register-developer - публичная само­регистрация застройщика.
// Создаёт аккаунт в статусе PENDING (войти нельзя до одобрения админом).
authRouter.post('/register-developer', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerDeveloperSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: 'DEVELOPER',
        status: 'PENDING',
        isActive: false, // страховка: даже без проверки status логин заблокирован
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        companyName: data.companyName,
        bin: data.bin,
        companyPhone: data.phone,
      },
    });

    res.status(201).json({
      message: 'Заявка отправлена. После одобрения администратором вы сможете войти.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    console.error('Register developer error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/auth/developer-profile - застройщик правит профиль своей компании.
authRouter.put('/developer-profile', auth, requireRole('DEVELOPER'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = developerProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.bin !== undefined && { bin: data.bin }),
        ...(data.companyPhone !== undefined && { companyPhone: data.companyPhone }),
        ...(data.companyLogo !== undefined && { companyLogo: data.companyLogo }),
        ...(data.companyWebsite !== undefined && { companyWebsite: data.companyWebsite }),
        ...(data.companyDescription !== undefined && { companyDescription: data.companyDescription }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, role: true,
        companyName: true, bin: true, companyPhone: true, companyLogo: true,
        companyWebsite: true, companyDescription: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные данные', details: error.errors });
      return;
    }
    console.error('Update developer profile error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
