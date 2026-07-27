import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// Get user's notifications
notificationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '20', offset = '0', unreadOnly } = req.query;

        const where: any = { userId: req.user!.userId };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
        });

        // Для девелоперов - обогащаем уведомления о бронях контактами брокера
        let enrichedNotifications = notifications;
        if (req.user?.role === 'DEVELOPER') {
            enrichedNotifications = await Promise.all(
                notifications.map(async (notification) => {
                    if ((notification.type as string) === 'BOOKING') {
                        // Ищем последнюю бронь от этого уведомления
                        const recentBooking = await prisma.booking.findFirst({
                            where: {
                                apartment: {
                                    project: {
                                        developerId: req.user!.userId,
                                    },
                                },
                                createdAt: {
                                    gte: new Date(notification.createdAt.getTime() - 60000), // в пределах минуты
                                    lte: new Date(notification.createdAt.getTime() + 60000),
                                },
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

                        if (recentBooking?.broker) {
                            return {
                                ...notification,
                                brokerName: `${recentBooking.broker.firstName} ${recentBooking.broker.lastName}`,
                                brokerPhone: recentBooking.broker.phone,
                                brokerEmail: recentBooking.broker.email,
                            };
                        }
                    }
                    return notification;
                })
            );
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
