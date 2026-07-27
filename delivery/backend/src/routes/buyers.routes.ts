// =========================================
// BUYERS & SHOWS ROUTES (CASA CRM)
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';
import { deepSeekService } from '../services/deepseek.service';
import {
    CreateBuyerSchema, UpdateBuyerSchema,
    CreateShowSchema, UpdateShowSchema,
    CreateOfferSchema, UpdateOfferSchema
} from '../lib/validation.schemas';

export const buyersRouter = Router();

buyersRouter.use(authenticate);

// ------------------------------------------
// BUYERS CRUD
// ------------------------------------------

// GET /api/buyers
buyersRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { search, status } = req.query;
        const where: any = {};

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
        if (restrictedRoles.includes(req.user?.role || '')) {
            where.brokerId = req.user!.userId;
        }

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { firstName: { contains: search as string, mode: 'insensitive' } },
                { lastName: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string } },
            ];
        }

        const buyers = await prisma.buyer.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 50,
            include: {
                _count: {
                    select: { shows: true, offers: true }
                }
            }
        });

        res.json(buyers);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения покупателей' });
    }
});

// GET /api/buyers/:id
buyersRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const buyer = await prisma.buyer.findUnique({
            where: { id },
            include: {
                shows: { include: { property: true }, orderBy: { date: 'desc' } },
                offers: { include: { property: true }, orderBy: { createdAt: 'desc' } }
            }
        });

        if (!buyer) {
            res.status(404).json({ error: 'Покупатель не найден' });
            return;
        }

        // Access check
        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
        if (restrictedRoles.includes(req.user?.role || '') && buyer.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        res.json(buyer);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения покупателя' });
    }
});

// POST /api/buyers
buyersRouter.post('/', validate(CreateBuyerSchema), async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const buyer = await prisma.buyer.create({
            data: {
                ...data,
                brokerId: req.user!.userId,
            },
        });
        res.status(201).json(buyer);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка создания покупателя' });
    }
});

// PUT /api/buyers/:id
buyersRouter.put('/:id', validate(UpdateBuyerSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const buyer = await prisma.buyer.update({
            where: { id },
            data
        });
        res.json(buyer);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка обновления покупателя' });
    }
});

// ------------------------------------------
// SHOWS & ANALYTICS
// ------------------------------------------

// GET /api/buyers/shows/:propertyId - список показов по объекту
buyersRouter.get('/shows/:propertyId', async (req: Request, res: Response) => {
    try {
        const { propertyId } = req.params;
        const shows = await prisma.show.findMany({
            where: { propertyId },
            include: { buyer: true },
            orderBy: { date: 'desc' },
        });
        res.json(shows);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения показов' });
    }
});

// POST /api/buyers/shows
buyersRouter.post('/shows', validate(CreateShowSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { buyerId, propertyId, date, status, notes } = req.body;

        // 1. Создать Show
        const show = await prisma.show.create({
            data: {
                propertyId,
                buyerId,
                date: new Date(date),
                status,
                feedback: notes, // map notes to initial feedback if provided
            },
            include: { buyer: true },
        });

        // Update counts
        await prisma.crmProperty.update({
            where: { id: propertyId },
            data: { showsCount: { increment: 1 } }
        });

        res.status(201).json(show);
    } catch (error) {
        console.error("Show create error:", error);
        res.status(500).json({ error: 'Ошибка создания показа' });
    }
});

// PUT /api/buyers/shows/:id (Feedback & Status)
buyersRouter.put('/shows/:id', validate(UpdateShowSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { feedback, status, rating, feedbackSentiment } = req.body;

        const existing = await prisma.show.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: "Show not found" });
            return;
        }

        const show = await prisma.show.update({
            where: { id },
            data: {
                feedback,
                status,
                rating,
                feedbackSentiment
            }
        });

        // AI TRIGGER: If feedback is added/updated
        if (feedback && feedback.length > 5) {
            const propertyId = existing.propertyId;

            // Fetch recent feedbacks
            const recentShows = await prisma.show.findMany({
                where: {
                    propertyId: propertyId,
                    feedback: { not: null },
                },
                orderBy: { date: 'desc' },
                take: 10,
            });

            const feedbacks = recentShows.map(s => s.feedback).filter(Boolean) as string[];

            if (feedbacks.length >= 3) {
                // Analyze
                const analysis = await deepSeekService.analyzeShowFeedbacks(feedbacks);

                if (analysis.suggestStrategyChange || analysis.criticalIssue) {
                    await prisma.crmProperty.update({
                        where: { id: propertyId },
                        data: {
                            aiRecommendation: analysis.recommendation,
                            // Could also auto-update strategy if we wanted, but let's just recommend
                        }
                    });
                }
            }
        }

        res.json(show);
    } catch (error) {
        console.error("Show update error:", error);
        res.status(500).json({ error: 'Ошибка обновления показа' });
    }
});

// ------------------------------------------
// OFFERS
// ------------------------------------------

// GET /api/buyers/offers/:propertyId
buyersRouter.get('/offers/:propertyId', async (req: Request, res: Response) => {
    try {
        const { propertyId } = req.params;
        const offers = await prisma.offer.findMany({
            where: { propertyId },
            include: { buyer: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(offers);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения офферов' });
    }
});

// POST /api/buyers/offers
buyersRouter.post('/offers', validate(CreateOfferSchema), async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const offer = await prisma.offer.create({
            data: {
                ...data,
                status: 'PENDING'
            },
            include: { buyer: true }
        });

        // Notify Broker?

        res.status(201).json(offer);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка создания оффера' });
    }
});

// PUT /api/buyers/offers/:id
buyersRouter.put('/offers/:id', validate(UpdateOfferSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const offer = await prisma.offer.update({
            where: { id },
            data,
            include: { buyer: true }
        });
        res.json(offer);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка обновления оффера' });
    }
});
