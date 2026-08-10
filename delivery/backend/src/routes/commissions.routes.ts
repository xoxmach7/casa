// =========================================
// COMMISSIONS ROUTES (CASA CRM)
// Tracks a Deal's commission through its payment lifecycle (estimated ->
// ... -> paid) with an append-only status-change log, instead of a single
// static number on the Deal.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { blockCrmWrites } from '../lib/access';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';

export const commissionsRouter = Router();
commissionsRouter.use(authenticate);
commissionsRouter.use(blockCrmWrites);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];

const COMMISSION_STATUSES = [
    'ESTIMATED',
    'EXPECTED',
    'CONFIRMED',
    'INVOICED',
    'RECEIVED',
    'PAYABLE_TO_PARTNER',
    'PAID',
    'DISPUTED',
    'CANCELLED',
] as const;

const updateStatusSchema = z.object({
    status: z.enum(COMMISSION_STATUSES),
    note: z.string().optional(),
});

// GET /api/commissions - список комиссий (брокер видит только свои сделки)
commissionsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, page = '1', limit = '50' } = req.query;
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;

        const where: any = {};
        if (status) where.status = status;
        if (RESTRICTED_ROLES.includes(req.user?.role || '')) {
            where.deal = { brokerId: req.user!.userId };
        }

        const [commissions, total] = await Promise.all([
            prisma.commission.findMany({
                where,
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    deal: {
                        select: {
                            id: true,
                            amount: true,
                            brokerId: true,
                            broker: { select: { id: true, firstName: true, lastName: true } },
                            client: { select: { id: true, firstName: true, lastName: true } },
                        },
                    },
                },
            }),
            prisma.commission.count({ where }),
        ]);

        res.json({ commissions, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
    } catch (error) {
        console.error('List commissions error:', error);
        res.status(500).json({ error: 'Ошибка получения комиссий' });
    }
});

// GET /api/commissions/:id - детали + история статусов
commissionsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const commission = await prisma.commission.findUnique({
            where: { id: req.params.id },
            include: {
                deal: { select: { id: true, brokerId: true, amount: true } },
                statusHistory: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!commission) {
            res.status(404).json({ error: 'Комиссия не найдена' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && commission.deal.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        res.json(commission);
    } catch (error) {
        console.error('Get commission error:', error);
        res.status(500).json({ error: 'Ошибка получения комиссии' });
    }
});

// PATCH /api/commissions/:id/status - сменить статус (финансовая операция — только ADMIN)
commissionsRouter.patch(
    '/:id/status',
    requireRole('ADMIN'),
    validate(updateStatusSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { status, note } = req.body;

            const existing = await prisma.commission.findUnique({ where: { id: req.params.id } });
            if (!existing) {
                res.status(404).json({ error: 'Комиссия не найдена' });
                return;
            }

            const updated = await prisma.commission.update({
                where: { id: req.params.id },
                data: {
                    status,
                    statusHistory: {
                        create: { fromStatus: existing.status, toStatus: status, changedBy: req.user!.userId, note },
                    },
                },
                include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
            });

            res.json(updated);
        } catch (error) {
            console.error('Update commission status error:', error);
            res.status(500).json({ error: 'Ошибка обновления статуса комиссии' });
        }
    }
);
