import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { z } from 'zod';

export const eventsRouter = Router();

eventsRouter.use(authenticate);

// Validation Schemas
const createEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    type: z.enum(['SHOWING', 'MEETING', 'CALL', 'OTHER']),
    location: z.string().optional(),
    clientId: z.string().optional(),
    propertyId: z.string().optional(),
});

const updateEventSchema = createEventSchema.partial();

// Validate middleware helper
const validate = (schema: z.ZodSchema) => async (req: Request, res: Response, next: any) => {
    try {
        await schema.parseAsync(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors });
            return;
        }
        res.status(400).json({ error: 'Invalid request' });
    }
};

// =========================================
// GET /api/events - List events
// Query: start, end (ISO dates)
// =========================================
eventsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { start, end } = req.query;

        const where: any = { userId };

        if (start && end) {
            where.startDate = {
                gte: new Date(start as string),
                lte: new Date(end as string),
            };
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                client: {
                    select: { id: true, firstName: true, lastName: true }
                },
                property: {
                    select: {
                        id: true,
                        address: true,
                        residentialComplex: true,
                        rooms: true,
                        area: true
                    }
                }
            },
            orderBy: { startDate: 'asc' },
        });

        res.json(events);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// =========================================
// POST /api/events - Create event
// =========================================
eventsRouter.post('/', validate(createEventSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const data = req.body;

        const event = await prisma.event.create({
            data: {
                ...data,
                userId,
                // Ensure dates are Date objects if passed as strings (Prisma handles ISO strings usually but explicit is good)
            },
            include: {
                client: { select: { firstName: true, lastName: true } },
                property: { select: { address: true, residentialComplex: true } }
            }
        });

        res.status(201).json(event);
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// =========================================
// PUT /api/events/:id - Update event
// =========================================
eventsRouter.put('/:id', validate(updateEventSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;
        const data = req.body;

        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const event = await prisma.event.update({
            where: { id },
            data,
            include: {
                client: { select: { firstName: true, lastName: true } },
                property: { select: { address: true, residentialComplex: true } }
            }
        });

        res.json(event);
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// =========================================
// DELETE /api/events/:id - Delete event
// =========================================
eventsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        await prisma.event.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});
