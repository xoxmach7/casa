// =========================================
// PUBLIC SELECTIONS ROUTES (CASA CRM)
// Unauthenticated, token-gated access so a client can open their "Подборка"
// via a link without a CRM login — never returns broker/client PII, internal
// notes, or anything beyond apartment listing data.
// =========================================

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const publicSelectionsRouter = Router();

const APARTMENT_SELECT = {
    id: true,
    number: true,
    floor: true,
    rooms: true,
    area: true,
    price: true,
    status: true,
    project: {
        select: { id: true, name: true, address: true, district: true },
    },
};

// GET /api/public/selections/:shareToken
publicSelectionsRouter.get('/:shareToken', async (req: Request, res: Response): Promise<void> => {
    try {
        const { shareToken } = req.params;

        const selection = await prisma.selection.findUnique({
            where: { shareToken },
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                selectedApartmentId: true,
                apartments: {
                    orderBy: { addedAt: 'desc' },
                    select: {
                        apartmentId: true,
                        apartment: { select: APARTMENT_SELECT },
                    },
                },
            },
        });

        if (!selection) {
            res.status(404).json({ error: 'Подборка не найдена' });
            return;
        }

        // First open transitions SHARED -> VIEWED; re-opening doesn't regress
        // an already-further-along status (e.g. CLIENT_SELECTED, CLOSED).
        if (selection.status === 'SHARED') {
            await prisma.selection.update({
                where: { shareToken },
                data: { status: 'VIEWED', viewedAt: new Date() },
            });
            selection.status = 'VIEWED';
        }

        res.json({
            name: selection.name,
            status: selection.status,
            createdAt: selection.createdAt,
            selectedApartmentId: selection.selectedApartmentId,
            apartments: selection.apartments.map((a) => a.apartment),
        });
    } catch (error) {
        console.error('Get public selection error:', error);
        res.status(500).json({ error: 'Ошибка получения подборки' });
    }
});

// POST /api/public/selections/:shareToken/apartments/:apartmentId/select
// Client marks the apartment they liked — moves the whole selection to
// CLIENT_SELECTED so the broker sees it needs follow-up.
publicSelectionsRouter.post(
    '/:shareToken/apartments/:apartmentId/select',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { shareToken, apartmentId } = req.params;

            const selection = await prisma.selection.findUnique({ where: { shareToken } });
            if (!selection) {
                res.status(404).json({ error: 'Подборка не найдена' });
                return;
            }

            const belongs = await prisma.selectionApartment.findUnique({
                where: { selectionId_apartmentId: { selectionId: selection.id, apartmentId } },
            });
            if (!belongs) {
                res.status(404).json({ error: 'Квартира не найдена в этой подборке' });
                return;
            }

            const updated = await prisma.selection.update({
                where: { shareToken },
                data: { status: 'CLIENT_SELECTED', selectedApartmentId: apartmentId },
            });

            res.json({ status: updated.status, selectedApartmentId: updated.selectedApartmentId });
        } catch (error) {
            console.error('Select apartment in public selection error:', error);
            res.status(500).json({ error: 'Ошибка выбора квартиры' });
        }
    }
);
