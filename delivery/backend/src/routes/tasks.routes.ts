import { Router } from 'express';
import { auth } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// Get user's tasks
router.get('/', auth, async (req, res) => {
    try {
        const { isCompleted } = req.query;

        const where: any = { userId: req.user!.userId };
        if (isCompleted !== undefined) {
            where.isCompleted = isCompleted === 'true';
        }

        const tasks = await prisma.task.findMany({
            where,
            orderBy: [
                { isCompleted: 'asc' },
                { dueDate: 'asc' },
                { createdAt: 'desc' },
            ],
        });

        return res.json(tasks);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Create task
router.post('/', auth, async (req, res) => {
    try {
        const { title, description, dueDate } = req.body;

        const task = await prisma.task.create({
            data: {
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                userId: req.user!.userId,
            },
        });

        return res.status(201).json(task);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Update task
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, description, dueDate, isCompleted } = req.body;

        await prisma.task.updateMany({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
            data: {
                title,
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                isCompleted,
                completedAt: isCompleted ? new Date() : null,
            },
        });

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
    try {
        await prisma.task.deleteMany({
            where: {
                id: req.params.id,
                userId: req.user!.userId,
            },
        });

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export { router as tasksRouter };
