// =========================================
// SCORING ROUTES (CASA CRM)
// Ипотечный скоринг клиента по КИ (кредитная история) и ПО (пенсионные
// отчисления), введённым брокером вручную — без интеграции с ЕНПФ/бюро.
// =========================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { prisma } from '../lib/prisma';
import { computeScoring, matchPrograms } from '../lib/scoring.service';

export const scoringRouter = Router();
scoringRouter.use(authenticate);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];

const createScoringSchema = z.object({
    clientId: z.string().min(1),
    creditHistoryStatus: z.enum(['GOOD', 'HAS_DELAYS', 'BAD']),
    avgMonthlyPension: z.number().nonnegative(),
    existingMonthlyDebt: z.number().nonnegative().default(0),
});

// POST /api/scoring - рассчитать и сохранить скоринг клиента
scoringRouter.post('/', validate(createScoringSchema), async (req: Request, res: Response): Promise<void> => {
    try {
        const { clientId, creditHistoryStatus, avgMonthlyPension, existingMonthlyDebt } = req.body;

        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            res.status(404).json({ error: 'Клиент не найден' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        const monthlyIncome = client.monthlyIncome ? Number(client.monthlyIncome) : 0;

        const result = computeScoring({
            monthlyIncome,
            creditHistoryStatus,
            avgMonthlyPension,
            existingMonthlyDebt,
        });

        const scoring = await prisma.clientScoring.create({
            data: {
                clientId,
                creditHistoryStatus,
                avgMonthlyPension,
                existingMonthlyDebt,
                scoreValue: result.scoreValue,
                approvalLikelihood: result.approvalLikelihood,
                maxLoanAmount: result.maxLoanAmount,
                maxMonthlyPayment: result.maxMonthlyPayment,
                advice: result.advice,
            },
        });

        const activePrograms = await prisma.mortgageProgram.findMany({ where: { isActive: true } });
        const matchedPrograms = matchPrograms(
            activePrograms.map((p) => ({
                id: p.id,
                bankName: p.bankName,
                programName: p.programName,
                interestRate: Number(p.interestRate),
                maxTerm: p.maxTerm,
            })),
            result.maxLoanAmount,
            result.maxMonthlyPayment
        );

        res.status(201).json({ ...scoring, matchedPrograms });
    } catch (error) {
        console.error('Create scoring error:', error);
        res.status(500).json({ error: 'Ошибка расчёта скоринга' });
    }
});

// GET /api/scoring/:clientId - история скоринга клиента (последний первым)
scoringRouter.get('/:clientId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { clientId } = req.params;

        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            res.status(404).json({ error: 'Клиент не найден' });
            return;
        }

        if (RESTRICTED_ROLES.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        const scorings = await prisma.clientScoring.findMany({
            where: { clientId },
            orderBy: { createdAt: 'desc' },
        });

        res.json(scorings);
    } catch (error) {
        console.error('Get scoring history error:', error);
        res.status(500).json({ error: 'Ошибка получения истории скоринга' });
    }
});
