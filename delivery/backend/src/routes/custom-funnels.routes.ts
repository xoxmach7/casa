import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

import { authenticate } from '../middleware/auth.middleware';

export const customFunnelsRouter = Router();

customFunnelsRouter.use(authenticate);

// Validation schemas
const createStageSchema = z.object({
    name: z.string().min(1),
    color: z.string().default("#3B82F6"),
    order: z.number().int(),
});

const createFunnelSchema = z.object({
    name: z.string().min(1),
    isActive: z.boolean().optional(),
    stages: z.array(createStageSchema).optional(),
});

const updateFunnelSchema = z.object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    stages: z.array(createStageSchema.extend({ id: z.string().optional() })).optional(),
});

// GET /api/custom-funnels
customFunnelsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const funnels = await prisma.customFunnel.findMany({
            where: { userId },
            include: {
                stages: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(funnels);
    } catch (error) {
        console.error('Error fetching custom funnels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/custom-funnels
customFunnelsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const data = createFunnelSchema.parse(req.body);

        const funnel = await prisma.customFunnel.create({
            data: {
                userId,
                name: data.name,
                isActive: data.isActive ?? true,
                stages: {
                    create: data.stages?.map(stage => ({
                        name: stage.name,
                        color: stage.color,
                        order: stage.order,
                    })),
                },
            },
            include: {
                stages: true,
            },
        });

        res.status(201).json(funnel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors });
        } else {
            console.error('Error creating custom funnel:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// GET /api/custom-funnels/:id
customFunnelsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const funnel = await prisma.customFunnel.findUnique({
            where: { id },
            include: {
                stages: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!funnel || funnel.userId !== userId) {
            res.status(404).json({ error: 'Funnel not found' });
            return;
        }

        res.json(funnel);
    } catch (error) {
        console.error('Error fetching custom funnel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/custom-funnels/:id
customFunnelsRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const funnel = await prisma.customFunnel.findUnique({
            where: { id },
        });

        if (!funnel || funnel.userId !== userId) {
            res.status(404).json({ error: 'Funnel not found' });
            return;
        }

        const data = updateFunnelSchema.parse(req.body);

        // If active status changed, potentially deactivate others?
        // For now, simple update.

        // Transaction to update stages if provided
        await prisma.$transaction(async (tx) => {
            // Update funnel details
            await tx.customFunnel.update({
                where: { id },
                data: {
                    name: data.name,
                    isActive: data.isActive,
                },
            });

            // Update stages if provided
            if (data.stages) {
                // Simple strategy: Delete all stages and recreate? 
                // Or upsert? Recreating is safer for ordering changes but loses IDs.
                // Let's delete and recreate for simplicity in V1 for custom funnels.
                // BEWARE: If we had data linked to stages, this would be bad.
                // But currently data (Sellers/Properties) links to enum stages or maybe strings?
                // Wait, 'funnelStage' in Seller/Property is an ENUM.
                // So they CANNOT link to custom stages directly unless we change the type to String key.

                // IMPORTANT: The Seller/Property models use ENUM `SellerFunnelStage`.
                // To support custom stages, we MUST change this to String or add a separate field.
                // Implementation plan said: "Custom stages: CRUD for funnel stages".
                // If we want real custom stages, we need to migrate `funnelStage` to String or add a relation.

                // Checking schema again...
                // funnelStage SellerFunnelStage @default(CONTACT)
                // This is a blocker for custom stages unless we map them somehow.
                // OR we just use custom stages for visualization and map them to closest enum?
                // No, custom usually means defining your own steps.

                // For Phase 2, maybe I should migrate `funnelStage` to specific custom stage ID?
                // Or keep it as 'CUSTOM' and use a separate field?

                // Let's defer this complexity. For now, I'll allow creating the funnel structure.
                // Linking it to items will require schema change I missed.

                await tx.customStage.deleteMany({
                    where: { funnelId: id },
                });

                if (data.stages.length > 0) {
                    await tx.customStage.createMany({
                        data: data.stages.map(s => ({
                            name: s.name,
                            color: s.color,
                            order: s.order,
                            funnelId: id,
                        })),
                    });
                }
            }
        });

        const updatedFunnel = await prisma.customFunnel.findUnique({
            where: { id },
            include: { stages: { orderBy: { order: 'asc' } } },
        });

        res.json(updatedFunnel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors });
        } else {
            console.error('Error updating custom funnel:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// DELETE /api/custom-funnels/:id
customFunnelsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const funnel = await prisma.customFunnel.findUnique({
            where: { id },
        });

        if (!funnel || funnel.userId !== userId) {
            res.status(404).json({ error: 'Funnel not found' });
            return;
        }

        await prisma.customFunnel.delete({
            where: { id },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting custom funnel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
