import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/jwt';
import { prisma } from '../lib/prisma';

// Расширяем Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Try cookie first, then Authorization header (backward compatibility)
    let token: string | undefined;

    if (req.cookies?.token) {
      token = req.cookies.token;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = verifyToken(token);

    // Токен подписан нами и не истёк — но этого мало. JWT stateless и живёт
    // 7 дней, поэтому подпись ничего не говорит о том, не заблокировали ли
    // пользователя и не сменили ли ему роль уже ПОСЛЕ выдачи токена (см.
    // docs/SECURITY-AUDIT-2026-08-10.md, MEDIUM-2). Сверяемся с базой на
    // каждом запросе: одно чтение по первичному ключу — дёшево.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Роль берём из базы, а не из токена: понижение прав вступает в силу
    // сразу, без ожидания истечения старого токена.
    req.user = { ...payload, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Alias for convenience
export const auth = authenticate;

// Проверка роли
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
};
