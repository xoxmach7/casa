// =========================================
// GLOBAL SEARCH ROUTES (CASA Admin)
// One query across clients/properties/apartments/projects instead of only
// per-list filters (ТЗ раздел 12 — global search across objects, apartments,
// clients, ЖК, developers, fixations, mortgage cases).
// =========================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export const searchRouter = Router();
searchRouter.use(authenticate);
searchRouter.use(requireRole('ADMIN'));

const RESULT_LIMIT_PER_TYPE = 10;

// GET /api/admin/search?q=...
searchRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) {
            res.json({ clients: [], properties: [], apartments: [], projects: [], fixations: [] });
            return;
        }

        const [clients, properties, apartments, projects, fixations] = await Promise.all([
            prisma.client.findMany({
                where: {
                    OR: [
                        { firstName: { contains: q, mode: 'insensitive' } },
                        { lastName: { contains: q, mode: 'insensitive' } },
                        { phone: { contains: q, mode: 'insensitive' } },
                        { iin: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: RESULT_LIMIT_PER_TYPE,
                select: { id: true, firstName: true, lastName: true, phone: true },
            }),
            prisma.crmProperty.findMany({
                where: {
                    OR: [
                        { residentialComplex: { contains: q, mode: 'insensitive' } },
                        { address: { contains: q, mode: 'insensitive' } },
                        { district: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: RESULT_LIMIT_PER_TYPE,
                select: { id: true, residentialComplex: true, district: true, address: true },
            }),
            prisma.apartment.findMany({
                where: { number: { contains: q, mode: 'insensitive' } },
                take: RESULT_LIMIT_PER_TYPE,
                select: { id: true, number: true, project: { select: { id: true, name: true } } },
            }),
            prisma.project.findMany({
                where: {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { developerName: { contains: q, mode: 'insensitive' } },
                        { address: { contains: q, mode: 'insensitive' } },
                    ],
                },
                take: RESULT_LIMIT_PER_TYPE,
                select: { id: true, name: true, developerName: true, city: true },
            }),
            prisma.fixation.findMany({
                where: {
                    OR: [
                        { client: { firstName: { contains: q, mode: 'insensitive' } } },
                        { client: { lastName: { contains: q, mode: 'insensitive' } } },
                        { project: { name: { contains: q, mode: 'insensitive' } } },
                    ],
                },
                take: RESULT_LIMIT_PER_TYPE,
                select: {
                    id: true,
                    status: true,
                    client: { select: { id: true, firstName: true, lastName: true } },
                    project: { select: { id: true, name: true } },
                },
            }),
        ]);

        res.json({ clients, properties, apartments, projects, fixations });
    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Ошибка поиска' });
    }
});
