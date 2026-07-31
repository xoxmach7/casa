import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const BOOKING_MATCH_WINDOW_MS = 60000;

// Get user's notifications
notificationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = String(DEFAULT_LIMIT), offset = '0', unreadOnly } = req.query;
        const take = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

        const where: any = { userId: req.user!.userId };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip: Number(offset),
        });

        // Для девелоперов - обогащаем уведомления о бронях контактами брокера
        let enrichedNotifications: typeof notifications = notifications;
        const bookingNotifications = notifications.filter((n) => (n.type as string) === 'BOOKING');
        if (req.user?.role === 'DEVELOPER' && bookingNotifications.length > 0) {
            const timestamps = bookingNotifications.map((n) => n.createdAt.getTime());
            const windowStart = new Date(Math.min(...timestamps) - BOOKING_MATCH_WINDOW_MS);
            const windowEnd = new Date(Math.max(...timestamps) + BOOKING_MATCH_WINDOW_MS);

            const candidateBookings = await prisma.booking.findMany({
                where: {
                    apartment: {
                        project: {
                            developerId: req.user!.userId,
                        },
                    },
                    createdAt: { gte: windowStart, lte: windowEnd },
                },
                include: {
                    broker: {
                        select: {
                            firstName: true,
                            lastName: true,
                            phone: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            enrichedNotifications = notifications.map((notification) => {
                if ((notification.type as string) !== 'BOOKING') return notification;

                const recentBooking = candidateBookings.find(
                    (b) =>
                        Math.abs(b.createdAt.getTime() - notification.createdAt.getTime()) <=
                        BOOKING_MATCH_WINDOW_MS
                );

                if (recentBooking?.broker) {
                    return {
                        ...notification,
                        brokerName: `${recentBooking.broker.firstName} ${recentBooking.broker.lastName}`,
                        brokerPhone: recentBooking.broker.phone,
                        brokerEmail: recentBooking.broker.email,
                    } as typeof notification;
                }
                return notification;
            });
        }

        const totalCount = await prisma.notification.count({ where });
        const unreadCount = await prisma.notification.count({
            where: { userId: req.user!.userId, isRead: false },
        });

        res.json({ notifications: enrichedNotifications, totalCount, unreadCount });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Mark notification as read
notificationsRouter.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
    try {
        await prisma.notification.updateMany({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
            data: { isRead: true },
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Mark all notifications as read
notificationsRouter.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
    try {
        await prisma.notification.updateMany({
            where: {
                userId: req.user!.userId,
                isRead: false,
            },
            data: { isRead: true },
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Delete notification
notificationsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        await prisma.notification.deleteMany({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
