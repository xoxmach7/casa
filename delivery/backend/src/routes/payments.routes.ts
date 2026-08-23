import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auth } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

const paymentSchema = z.object({
    brokerId: z.string().trim().min(1),
    amount: z.number().finite().positive().max(999_999_999_999.99),
    type: z.preprocess(
        (value) => typeof value === 'string' ? value.toUpperCase() : value,
        z.enum(['INCOME', 'EXPENSE']),
    ),
    description: z.string().trim().min(1).max(1000),
}).strict();

const idempotencyKeySchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
type PaymentInput = z.infer<typeof paymentSchema>;

class IdempotencyConflictError extends Error {}

function samePayment(input: PaymentInput, existing: { userId: string; amount: unknown; type: string; description: string }): boolean {
    return existing.userId === input.brokerId
        && Number(existing.amount) === input.amount
        && existing.type === input.type
        && existing.description === input.description;
}

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

router.get('/balance', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { balance: true } });
        return res.json({ balance: Number(user?.balance || 0) });
    } catch (error) {
        console.error('Error fetching balance:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Доступ запрещен' });
        const { brokerId } = req.query;
        const where = brokerId ? { userId: brokerId as string } : {};
        const payments = await prisma.payment.findMany({
            where,
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Add payment and balance change atomically (admin only).
router.post('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Доступ запрещен' });

        const parsed = paymentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Ошибка валидации', details: parsed.error.flatten() });
        }
        const idempotencyHeader = req.get('Idempotency-Key');
        const parsedKey = idempotencyHeader === undefined ? undefined : idempotencyKeySchema.safeParse(idempotencyHeader);
        if (parsedKey && !parsedKey.success) {
            return res.status(400).json({ error: 'Некорректный Idempotency-Key' });
        }
        const idempotencyKey = parsedKey?.data;
        const input = parsed.data;
        let replayed = false;

        const payment = await prisma.$transaction(async (tx) => {
            if (idempotencyKey) {
                const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
                if (existing) {
                    if (!samePayment(input, existing)) throw new IdempotencyConflictError('Idempotency-Key уже использован для другой операции');
                    replayed = true;
                    return existing;
                }
            }

            const created = await tx.payment.create({
                data: { userId: input.brokerId, amount: input.amount, type: input.type, description: input.description, idempotencyKey },
            });
            await tx.user.update({
                where: { id: input.brokerId },
                data: { balance: { increment: input.type === 'INCOME' ? input.amount : -input.amount } },
            });
            return created;
        });

        return res.status(replayed ? 200 : 201).json(payment);
    } catch (error) {
        if (error instanceof IdempotencyConflictError) {
            return res.status(409).json({ error: error.message });
        }
        // A concurrent request may win the unique key race after both requests
        // pass the pre-check. The winning row is the safe replay response.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const key = req.get('Idempotency-Key')?.trim();
            if (key) {
                const existing = await prisma.payment.findUnique({ where: { idempotencyKey: key } });
                if (existing) {
                    const input = paymentSchema.parse(req.body);
                    if (!samePayment(input, existing)) return res.status(409).json({ error: 'Idempotency-Key уже использован для другой операции' });
                    return res.status(200).json(existing);
                }
            }
        }
        console.error('Error creating payment:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/broker/:brokerId', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Доступ запрещен' });
        const payments = await prisma.payment.findMany({ where: { userId: req.params.brokerId }, orderBy: { createdAt: 'desc' } });
        return res.json(payments);
    } catch (error) {
        console.error('Error fetching broker payments:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export { router as paymentsRouter };
