import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Simple audit log — writes to notifications table with type SYSTEM
export const auditLog = async (userId: string, action: string, details: string) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: action,
        message: details,
      },
    });
  } catch (e) {
    // Don't break the request if audit fails
    console.error('Audit log error:', e);
  }
};

// Middleware that logs mutating requests (POST, PUT, DELETE)
export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalEnd = res.end;
  const method = req.method;

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && req.user?.userId) {
    const startTime = Date.now();

    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const path = req.originalUrl || req.url;

      if (statusCode < 400) {
        auditLog(
          req.user!.userId,
          `${method} ${path}`,
          `Status: ${statusCode}, Duration: ${duration}ms`
        ).catch(() => {});
      }

      return originalEnd.apply(res, args as any);
    } as any;
  }

  next();
};
