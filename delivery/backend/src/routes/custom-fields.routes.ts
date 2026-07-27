
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';
import { CustomFieldType, CustomFieldEntity } from '@prisma/client';

export const customFieldsRouter = Router();

customFieldsRouter.use(authenticate);

// Validation Schemas
const createFieldSchema = z.object({
    name: z.string().min(1),
    type: z.nativeEnum(CustomFieldType),
    entityType: z.nativeEnum(CustomFieldEntity),
    funnelId: z.string().optional().nullable(),
    options: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

const updateFieldSchema = z.object({
    name: z.string().min(1).optional(),
    options: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
});

// GET /api/custom-fields
customFieldsRouter.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId; // Filter by user
        const { entityType, funnelId } = req.query;

        const where: any = { isActive: true };
        // If user is logged in, show their fields. 
        // TODO: For shared team fields, we might need to include curator's fields.
        // For now, strict ownership:
        if (userId) {
            where.userId = userId;
        }

        if (entityType) where.entityType = entityType as CustomFieldEntity;
        if (funnelId) where.funnelId = funnelId as string;

        const fields = await prisma.customField.findMany({
            where,
            orderBy: { createdAt: 'asc' },
        });

        res.json(fields);
    } catch (error) {
        console.error('Get custom fields error:', error);
        res.status(500).json({ error: 'Error fetching custom fields' });
    }
});

// POST /api/custom-fields
customFieldsRouter.post('/', requireRole('ADMIN', 'BROKER', 'AGENCY', 'REALTOR'), validate(createFieldSchema), async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const field = await prisma.customField.create({
            data: {
                ...req.body,
                userId, // Assign owner
            },
        });
        res.status(201).json(field);
    } catch (error) {
        console.error('Create custom field error:', error);
        res.status(500).json({ error: 'Error creating custom field' });
    }
});

// PUT /api/custom-fields/:id
customFieldsRouter.put('/:id', requireRole('ADMIN', 'BROKER', 'AGENCY', 'REALTOR'), validate(updateFieldSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;
        const userRole = req.user!.role;

        const existingField = await prisma.customField.findUnique({ where: { id } });
        if (!existingField) {
            res.status(404).json({ error: 'Field not found' });
            return;
        }

        // Check ownership or ADMIN
        if (existingField.userId !== userId && userRole !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const field = await prisma.customField.update({
            where: { id },
            data: req.body,
        });
        res.json(field);
    } catch (error) {
        console.error('Update custom field error:', error);
        res.status(500).json({ error: 'Error updating custom field' });
    }
});

// DELETE /api/custom-fields/:id
customFieldsRouter.delete('/:id', requireRole('ADMIN', 'BROKER', 'AGENCY', 'REALTOR'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;
        const userRole = req.user!.role;

        const existingField = await prisma.customField.findUnique({ where: { id } });
        if (!existingField) {
            res.status(404).json({ error: 'Field not found' });
            return;
        }

        // Check ownership or ADMIN
        if (existingField.userId !== userId && userRole !== 'ADMIN') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        // Hard delete for now
        await prisma.customField.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error('Delete custom field error:', error);
        res.status(500).json({ error: 'Error deleting custom field' });
    }
});
