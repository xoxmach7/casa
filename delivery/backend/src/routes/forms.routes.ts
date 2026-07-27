import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { UserRole, DealStage } from '@prisma/client';

export const formsRouter = Router();

// Validation schemas
const fieldSchema = z.object({
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
});

const createFormSchema = z.object({
    title: z.string().min(3),
    fields: z.array(fieldSchema),
    distributionType: z.enum(['MANUAL', 'ROUND_ROBIN']),
    brokerIds: z.array(z.string()).optional(), // Brokers to include in rotation
});

// Middleware for public access? No, different route prefix or handle here.
// We'll keep public separate or use /public path in index.ts
// For now, let's mix but checking auth only for admin actions.

// === ADMIN ROUTES ===

// POST /api/forms - Create form
formsRouter.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        console.log('Create form body:', JSON.stringify(req.body, null, 2));
        const data = createFormSchema.parse(req.body);

        const form = await prisma.leadForm.create({
            data: {
                title: data.title,
                fields: data.fields as any,
                distributionType: data.distributionType,
                brokers: {
                    connect: data.brokerIds?.map(id => ({ id })) || []
                }
            }
        });

        res.status(201).json(form);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Form validation error:', JSON.stringify(error.errors, null, 2));
            res.status(400).json({ error: 'Ошибка валидации', details: error.errors });
            return;
        }
        console.error('Create form error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/forms - List all forms
formsRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        const forms = await prisma.leadForm.findMany({
            include: {
                brokers: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(forms);
    } catch (error) {
        console.error('Get forms error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/forms/:id - Update form
formsRouter.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const data = createFormSchema.parse(req.body);

        // Update basic fields
        await prisma.leadForm.update({
            where: { id: req.params.id },
            data: {
                title: data.title,
                fields: data.fields as any,
                distributionType: data.distributionType,
                // Easy way to handle many-to-many updates: set (replace all)
                brokers: {
                    set: data.brokerIds?.map(id => ({ id })) || []
                }
            }
        });

        const updated = await prisma.leadForm.findUnique({
            where: { id: req.params.id },
            include: { brokers: { select: { id: true, firstName: true, lastName: true } } }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update form error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/forms/:id/toggle - Toggle form active status
formsRouter.patch('/:id/toggle', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const form = await prisma.leadForm.findUnique({ where: { id: req.params.id } });
        if (!form) {
            res.status(404).json({ error: 'Form not found' });
            return;
        }

        const updated = await prisma.leadForm.update({
            where: { id: req.params.id },
            data: { isActive: !form.isActive }
        });

        res.json(updated);
    } catch (error) {
        console.error('Toggle form error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/forms/:id - Delete form
formsRouter.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'ADMIN') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const form = await prisma.leadForm.findUnique({ where: { id: req.params.id } });
        if (!form) {
            res.status(404).json({ error: 'Form not found' });
            return;
        }

        await prisma.leadForm.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Form deleted' });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
