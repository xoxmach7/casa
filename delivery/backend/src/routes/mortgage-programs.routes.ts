import { Router } from 'express';
import { auth } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

// Get all mortgage programs
router.get('/', auth, async (req, res) => {
    try {
        const { bankName, propertyType, isActive } = req.query;

        const where: any = {};
        if (bankName) where.bankName = bankName;
        if (propertyType) where.propertyType = propertyType;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const programs = await prisma.mortgageProgram.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return res.json(programs);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get single program
router.get('/:id', auth, async (req, res) => {
    try {
        const program = await prisma.mortgageProgram.findUnique({
            where: { id: req.params.id },
        });

        if (!program) {
            return res.status(404).json({ error: 'Программа не найдена' });
        }

        return res.json(program);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Get unique bank names
router.get('/banks/list', auth, async (req, res) => {
    try {
        const banks = await prisma.mortgageProgram.findMany({
            where: { isActive: true },
            select: { bankName: true },
            distinct: ['bankName'],
        });

        return res.json(banks.map((b: any) => b.bankName));
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Create program (Admin only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        const program = await prisma.mortgageProgram.create({
            data: req.body,
        });

        return res.status(201).json(program);
    } catch (error) {
        console.error('Create program error:', error);
        return res.status(500).json({ error: 'Ошибка создания программы' });
    }
});

// Update program (Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        const program = await prisma.mortgageProgram.update({
            where: { id: req.params.id },
            data: req.body,
        });

        return res.json(program);
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка обновления программы' });
    }
});

// Delete program (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user!.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Нет прав доступа' });
        }

        await prisma.mortgageProgram.delete({
            where: { id: req.params.id },
        });

        return res.json({ message: 'Программа удалена' });
    } catch (error) {
        return res.status(500).json({ error: 'Ошибка удаления программы' });
    }
});

export { router as mortgageProgramsRouter };
