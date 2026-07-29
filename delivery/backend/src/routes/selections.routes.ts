// =========================================
// SELECTIONS ROUTES (CASA CRM)
// "Подборки" — curated lists of new-build apartments a broker assembles
// for a specific client.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';

export const selectionsRouter = Router();
selectionsRouter.use(authenticate);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];

function scopeToOwnBroker(req: Request): { brokerId?: string } {
    if (RESTRICTED_ROLES.includes(req.user?.role || '')) {
        return { brokerId: req.user!.userId };
    }
    return {};
}

const createSelectionSchema = z.object({
    clientId: z.string().min(1),
    name: z.string().optional(),
});

const addApartmentSchema = z.object({
    apartmentId: z.string().min(1),
});

// GET /api/selections
selectionsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const selections = await prisma.selection.findMany({
            where: scopeToOwnBroker(req),
            orderBy: { createdAt: 'desc' },
            include: {
                client: { select: { id: true, firstName: true, lastName: true, phone: true } },
                _count: { select: { apartments: true } },
            },
        });

        res.json(selections);
    } catch (error) {
        console.error('List selections error:', error);
        res.status(500).json({ error: 'Ошибка получения подборок' });
    }
});

// GET /api/selections/:id
selectionsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const selection = await prisma.selection.findUnique({
            where: { id: req.params.id },
            include: {
                client: true,
                apartments: {
                    orderBy: { addedAt: 'desc' },
                    include: {
                        apartment: { include: { project: { select: { id: true, name: true, address: true } } } },
                    },
                },
            },
        });

        if (!selection) {
            res.status(404).json({ error: 'Подборка не найдена' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && selection.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        res.json(selection);
    } catch (error) {
        console.error('Get selection error:', error);
        res.status(500).json({ error: 'Ошибка получения подборки' });
    }
});

// POST /api/selections
selectionsRouter.post('/', validate(createSelectionSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { clientId, name } = req.body;

        const selection = await prisma.selection.create({
            data: {
                clientId,
                name,
                brokerId: req.user!.userId,
            },
            include: {
                client: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
        });

        res.status(201).json(selection);
    } catch (error) {
        console.error('Create selection error:', error);
        res.status(500).json({ error: 'Ошибка создания подборки' });
    }
});

// DELETE /api/selections/:id
selectionsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const existing = await prisma.selection.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            res.status(404).json({ error: 'Подборка не найдена' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && existing.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        await prisma.selection.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete selection error:', error);
        res.status(500).json({ error: 'Ошибка удаления подборки' });
    }
});

// POST /api/selections/:id/apartments
selectionsRouter.post(
    '/:id/apartments',
    validate(addApartmentSchema),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { apartmentId } = req.body;

            const selection = await prisma.selection.findUnique({ where: { id } });
            if (!selection) {
                res.status(404).json({ error: 'Подборка не найдена' });
                return;
            }

            if (RESTRICTED_ROLES.includes(req.user?.role || '') && selection.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            // Idempotent — adding an apartment already in the selection is a no-op.
            const entry = await prisma.selectionApartment.upsert({
                where: { selectionId_apartmentId: { selectionId: id, apartmentId } },
                update: {},
                create: { selectionId: id, apartmentId },
            });

            res.status(201).json(entry);
        } catch (error) {
            console.error('Add apartment to selection error:', error);
            res.status(500).json({ error: 'Ошибка добавления квартиры в подборку' });
        }
    }
);

// DELETE /api/selections/:id/apartments/:apartmentId
selectionsRouter.delete(
    '/:id/apartments/:apartmentId',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { id, apartmentId } = req.params;

            const selection = await prisma.selection.findUnique({ where: { id } });
            if (!selection) {
                res.status(404).json({ error: 'Подборка не найдена' });
                return;
            }

            if (RESTRICTED_ROLES.includes(req.user?.role || '') && selection.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            await prisma.selectionApartment.deleteMany({
                where: { selectionId: id, apartmentId },
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Remove apartment from selection error:', error);
            res.status(500).json({ error: 'Ошибка удаления квартиры из подборки' });
        }
    }
);
