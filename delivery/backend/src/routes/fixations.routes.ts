// =========================================
// FIXATIONS ROUTES (CASA CRM)
// "Фиксация" — заявка брокера застройщику на закрепление клиента за собой
// для конкретного ЖК перед показом/сделкой (ТЗ раздел 8). Models a real
// state machine (see fixation.service.ts) instead of jumping straight from
// client interest to Deal with no developer-confirmation step.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';
import { canTransition, FixationStatus } from '../lib/fixation.service';

export const fixationsRouter = Router();
fixationsRouter.use(authenticate);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY'];
const FIXATION_STATUSES = [
    'DRAFT', 'SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'REJECTED_DUPLICATE',
    'REJECTED_OTHER', 'EXPIRED', 'BOOKING_REQUESTED', 'BOOKED', 'DEAL', 'CANCELLED',
] as const;

const createFixationSchema = z.object({
    clientId: z.string().min(1),
    projectId: z.string().min(1),
    apartmentId: z.string().optional(),
    paymentMethod: z.enum(['FULL', 'MORTGAGE', 'INSTALLMENT']).optional(),
    dealAmount: z.number().positive().optional(),
});

const transitionSchema = z.object({
    status: z.enum(FIXATION_STATUSES),
    reason: z.string().optional(),
});

function scopeToOwnBroker(req: Request): { brokerId?: string } {
    if (RESTRICTED_ROLES.includes(req.user?.role || '')) {
        return { brokerId: req.user!.userId };
    }
    return {};
}

// GET /api/fixations
fixationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { status } = req.query;
        const where: any = { ...scopeToOwnBroker(req) };
        if (status) where.status = status;

        const fixations = await prisma.fixation.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                client: { select: { id: true, firstName: true, lastName: true, phone: true } },
                project: { select: { id: true, name: true } },
                apartment: { select: { id: true, number: true } },
            },
        });

        res.json(fixations);
    } catch (error) {
        console.error('List fixations error:', error);
        res.status(500).json({ error: 'Ошибка получения списка фиксаций' });
    }
});

// GET /api/fixations/:id
fixationsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const fixation = await prisma.fixation.findUnique({
            where: { id: req.params.id },
            include: {
                client: true,
                project: { select: { id: true, name: true, developerName: true } },
                apartment: true,
                broker: { select: { id: true, firstName: true, lastName: true, phone: true } },
                statusHistory: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!fixation) {
            res.status(404).json({ error: 'Фиксация не найдена' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && fixation.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        res.json(fixation);
    } catch (error) {
        console.error('Get fixation error:', error);
        res.status(500).json({ error: 'Ошибка получения фиксации' });
    }
});

// POST /api/fixations - создать черновик
fixationsRouter.post('/', validate(createFixationSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { clientId, projectId, apartmentId, paymentMethod, dealAmount } = req.body;

        const fixation = await prisma.fixation.create({
            data: {
                clientId,
                projectId,
                apartmentId,
                paymentMethod,
                dealAmount,
                brokerId: req.user!.userId,
                status: 'DRAFT',
                statusHistory: { create: { toStatus: 'DRAFT', changedBy: req.user!.userId } },
            },
            include: {
                client: { select: { id: true, firstName: true, lastName: true, phone: true } },
                project: { select: { id: true, name: true } },
            },
        });

        res.status(201).json(fixation);
    } catch (error) {
        console.error('Create fixation error:', error);
        res.status(500).json({ error: 'Ошибка создания фиксации' });
    }
});

// PATCH /api/fixations/:id/status - переход по состояниям (валидируется по стейт-машине)
fixationsRouter.patch(
    '/:id/status',
    validate(transitionSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { status, reason } = req.body as { status: FixationStatus; reason?: string };
            const { id } = req.params;

            const existing = await prisma.fixation.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Фиксация не найдена' });
                return;
            }

            if (RESTRICTED_ROLES.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            const fromStatus = existing.status as FixationStatus;
            if (!canTransition(fromStatus, status)) {
                res.status(400).json({ error: `Переход из статуса ${fromStatus} в ${status} недопустим` });
                return;
            }

            const isRejection = status === 'REJECTED_DUPLICATE' || status === 'REJECTED_OTHER';

            const updateData: any = {
                status,
                statusHistory: { create: { fromStatus, toStatus: status, changedBy: req.user!.userId, note: reason } },
            };
            if (status === 'SENT') {
                updateData.sentAt = new Date();
                // Заявка живёт 24 часа, если застройщик не ответил.
                updateData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            }
            if (isRejection) {
                updateData.rejectionReason = reason ?? null;
            }

            const updated = await prisma.fixation.update({ where: { id }, data: updateData });

            await prisma.notification.create({
                data: {
                    userId: existing.brokerId,
                    type: 'DEAL',
                    title: 'Статус фиксации изменился',
                    message: `Фиксация клиента переведена в статус «${status}»${reason ? `: ${reason}` : ''}`,
                },
            });

            res.json(updated);
        } catch (error) {
            console.error('Transition fixation error:', error);
            res.status(500).json({ error: 'Ошибка изменения статуса фиксации' });
        }
    }
);
