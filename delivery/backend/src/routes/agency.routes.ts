
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth.middleware';

export const agencyRouter = Router();

// Все роуты требуют аутентификацию и роль AGENCY
agencyRouter.use(authenticate);
agencyRouter.use(requireRole('AGENCY'));

// =========================================
// GET /api/agency/team - Список риелторов агентства
// =========================================
agencyRouter.get('/team', async (req: Request, res: Response): Promise<void> => {
    try {
        const agencyId = req.user!.userId;

        const realtors = await prisma.user.findMany({
            where: {
                curatorId: agencyId,
                role: 'REALTOR',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                city: true,
                createdAt: true,
                isActive: true, // Assuming isActive exists on User model
                // Include stats if needed
                _count: {
                    select: {
                        deals: true,
                        sellers: true, // Sellers assigned
                        crmProperties: true, // Properties assigned
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(realtors);
    } catch (error) {
        console.error('Get agency team error:', error);
        res.status(500).json({ error: 'Ошибка получения списка команды' });
    }
});

// =========================================
// POST /api/agency/team - Добавить риелтора (создать пользователя)
// =========================================
agencyRouter.post('/team', async (req: Request, res: Response): Promise<void> => {
    try {
        const agencyId = req.user!.userId;
        const { email, password, firstName, lastName, phone, city } = req.body;

        if (!email || !password || !firstName || !lastName) {
            res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
            return;
        }

        // Проверка уникальности email
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем риелтора с привязкой к агентству (curatorId)
        const realtor = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone,
                city,
                role: 'REALTOR',
                curatorId: agencyId,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
            },
        });

        res.status(201).json(realtor);
    } catch (error) {
        console.error('Create realtor error:', error);
        res.status(500).json({ error: 'Ошибка добавления риелтора' });
    }
});

// =========================================
// PUT /api/agency/team/:id - Редактировать риелтора
// =========================================
agencyRouter.put('/team/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const agencyId = req.user!.userId;
        const { id } = req.params;
        const { firstName, lastName, phone, city, isActive } = req.body;

        // Verify realtor belongs to agency
        const existing = await prisma.user.findFirst({
            where: {
                id,
                curatorId: agencyId,
                role: 'REALTOR',
            },
        });

        if (!existing) {
            res.status(404).json({ error: 'Риелтор не найден or access denied' });
            return;
        }

        const updatedRealtor = await prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                phone,
                city,
                isActive,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                city: true,
                isActive: true,
            },
        });

        res.json(updatedRealtor);
    } catch (error) {
        console.error('Update realtor error:', error);
        res.status(500).json({ error: 'Ошибка обновления данных риелтора' });
    }
});

// =========================================
// DELETE /api/agency/team/:id - Удалить (отвязать/деактивировать) риелтора
// =========================================
agencyRouter.delete('/team/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const agencyId = req.user!.userId;
        const { id } = req.params;

        // Verify realtor belongs to agency
        const existing = await prisma.user.findFirst({
            where: {
                id,
                curatorId: agencyId,
                role: 'REALTOR',
            },
        });

        if (!existing) {
            res.status(404).json({ error: 'Риелтор не найден or access denied' });
            return;
        }

        // We can either delete the user or just deactivate them and remove curatorId
        // Deleting might be dangerous if they have deals.
        // Let's just unset curatorId and set isActive=false for safety, or full delete if requested.
        // For MVP, complete deletion to be clean, cascading will handle relations if set up,
        // but User deletion usually is restricted.
        // Let's try to delete, if fails due to constraints, we'll handle it.
        // Actually best practice is soft delete or de-linking.
        // Agency wants to remove them from team.

        // Approach 1: Deactivate and Unlink
        await prisma.user.update({
            where: { id },
            data: {
                curatorId: null,
                isActive: false
            }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Delete realtor error:', error);
        res.status(500).json({ error: 'Ошибка удаления риелтора' });
    }
});
