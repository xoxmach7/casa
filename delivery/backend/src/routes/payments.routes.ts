import { Router } from 'express';
import { auth } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// Get my payments (broker)
router.get('/my', auth, async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { userId: req.user!.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        const formatted = payments.map(p => ({
            id: p.id,
            amount: Number(p.amount),
            type: p.type.toLowerCase() as 'income' | 'expense',
            description: p.description,
            createdAt: p.createdAt.toISOString(),
        }));

        return res.json({ payments: formatted });
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get broker's balance (broker)
router.get('/balance', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { balance: true },
        });

        return res.json({ balance: Number(user?.balance || 0) });
    } catch (error) {
        console.error('Error fetching balance:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========= ADMIN Routes =========

// Get all payments (admin)
router.get('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { brokerId } = req.query;

        const where = brokerId ? { userId: brokerId as string } : {};

        const payments = await prisma.payment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Add payment (admin) - income or expense
router.post('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { brokerId, amount, type, description } = req.body;

        if (!brokerId || !amount || !type || !description) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        // Create payment
        const payment = await prisma.payment.create({
            data: {
                userId: brokerId,
                amount,
                type: type.toUpperCase(),
                description,
            },
        });

        // Update broker balance
        const balanceChange = type.toUpperCase() === 'INCOME' ? amount : -amount;
        await prisma.user.update({
            where: { id: brokerId },
            data: {
                balance: {
                    increment: balanceChange,
                },
            },
        });

        return res.status(201).json(payment);
    } catch (error) {
        console.error('Error creating payment:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get broker payments (admin)
router.get('/broker/:brokerId', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const payments = await prisma.payment.findMany({
            where: { userId: req.params.brokerId },
            orderBy: { createdAt: 'desc' },
        });

        return res.json(payments);
    } catch (error) {
        console.error('Error fetching broker payments:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export { router as paymentsRouter };
