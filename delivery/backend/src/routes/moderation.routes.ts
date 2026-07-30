// =========================================
// MODERATION ROUTES (CASA Admin)
// Queue of secondary-market objects awaiting CASA review before they can
// enter the closed catalog (ТЗ раздел 5/12 — статус MODERATION/NEEDS_INFORMATION).
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';

export const moderationRouter = Router();
moderationRouter.use(authenticate);
moderationRouter.use(requireRole('ADMIN'));

// GET /api/admin/moderation/properties?status=MODERATION
moderationRouter.get('/properties', async (req: Request, res: Response): Promise<void> => {
    try {
        const status = (req.query.status as string) || 'MODERATION';

        const properties = await prisma.crmProperty.findMany({
            where: { status: status as any },
            orderBy: { createdAt: 'asc' }, // oldest-first queue
            include: {
                seller: { select: { id: true, firstName: true, lastName: true, phone: true } },
                broker: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        res.json(properties);
    } catch (error) {
        console.error('List moderation queue error:', error);
        res.status(500).json({ error: 'Ошибка получения очереди модерации' });
    }
});

const decisionSchema = z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'NEEDS_INFO']),
    reason: z.string().optional(),
});
type Decision = z.infer<typeof decisionSchema>['decision'];

// PATCH /api/admin/moderation/properties/:id/decision
moderationRouter.patch(
    '/properties/:id/decision',
    validate(decisionSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const decision = req.body.decision as Decision;
            const reason = req.body.reason as string | undefined;
            const { id } = req.params;

            const property = await prisma.crmProperty.findUnique({ where: { id } });
            if (!property) {
                res.status(404).json({ error: 'Объект не найден' });
                return;
            }

            const statusMap = {
                APPROVE: 'ACTIVE',
                REJECT: 'ARCHIVED',
                NEEDS_INFO: 'NEEDS_INFORMATION',
            } as const;

            const updated = await prisma.crmProperty.update({
                where: { id },
                data: { status: statusMap[decision] as any },
            });

            const notificationCopy = {
                APPROVE: { title: 'Объект прошёл модерацию', message: `Объект «${property.residentialComplex}» одобрен и может публиковаться.` },
                REJECT: { title: 'Объект отклонён модерацией', message: `Объект «${property.residentialComplex}» отклонён.${reason ? ` Причина: ${reason}` : ''}` },
                NEEDS_INFO: { title: 'Модератор запросил уточнения', message: `По объекту «${property.residentialComplex}» нужны уточнения.${reason ? ` ${reason}` : ''}` },
            }[decision];

            await prisma.notification.create({
                data: {
                    userId: property.brokerId,
                    type: 'SYSTEM',
                    title: notificationCopy.title,
                    message: notificationCopy.message,
                },
            });

            res.json(updated);
        } catch (error) {
            console.error('Moderation decision error:', error);
            res.status(500).json({ error: 'Ошибка обработки решения модерации' });
        }
    }
);
