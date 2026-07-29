// =========================================
// SCORING ROUTES (CASA CRM)
// Ипотечный скоринг клиента по КИ (кредитная история) и ПО (пенсионные
// отчисления) — читается напрямую из PDF-документов, загруженных брокером
// (справка кредитного бюро, выписка ЕНПФ). Без прямой интеграции с
// ЕНПФ/бюро — брокер сам приносит документ, бэкенд его читает.
// =========================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { computeScoring, matchPrograms } from '../lib/scoring.service';
import {
    extractTextFromPdf,
    extractCreditHistoryStatus,
    extractAvgMonthlyPension,
    extractExistingMonthlyDebt,
} from '../lib/scoring-document.service';

export const scoringRouter = Router();
scoringRouter.use(authenticate);

const RESTRICTED_ROLES = ['BROKER', 'REALTOR', 'AGENCY', 'DEVELOPER'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function readPdfText(file: Express.Multer.File | undefined): Promise<string | null> {
    if (!file) return null;
    try {
        return await extractTextFromPdf(file.buffer);
    } catch (error) {
        console.error('PDF parse error:', error);
        return null;
    }
}

// POST /api/scoring - прочитать документы клиента, рассчитать и сохранить скоринг
// multipart/form-data: clientId, creditHistoryFile (справка КИ), pensionFile (выписка ЕНПФ)
scoringRouter.post(
    '/',
    upload.fields([
        { name: 'creditHistoryFile', maxCount: 1 },
        { name: 'pensionFile', maxCount: 1 },
    ]),
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { clientId } = req.body;
            if (!clientId) {
                res.status(400).json({ error: 'clientId обязателен' });
                return;
            }

            const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
            const creditHistoryFile = files?.creditHistoryFile?.[0];
            const pensionFile = files?.pensionFile?.[0];

            if (!creditHistoryFile && !pensionFile) {
                res.status(400).json({ error: 'Загрузите хотя бы один документ (справка КИ или выписка ЕНПФ)' });
                return;
            }

            const client = await prisma.client.findUnique({ where: { id: clientId } });
            if (!client) {
                res.status(404).json({ error: 'Клиент не найден' });
                return;
            }

            if (RESTRICTED_ROLES.includes(req.user?.role || '') && client.brokerId !== req.user!.userId) {
                res.status(403).json({ error: 'Доступ запрещен' });
                return;
            }

            const [creditHistoryText, pensionText] = await Promise.all([
                readPdfText(creditHistoryFile),
                readPdfText(pensionFile),
            ]);

            if (creditHistoryFile && creditHistoryText === null) {
                res.status(422).json({ error: 'Не удалось прочитать справку о кредитной истории — проверьте файл (нужен PDF с текстовым слоем)' });
                return;
            }
            if (pensionFile && pensionText === null) {
                res.status(422).json({ error: 'Не удалось прочитать выписку ЕНПФ — проверьте файл (нужен PDF с текстовым слоем)' });
                return;
            }

            const creditHistory = creditHistoryText
                ? extractCreditHistoryStatus(creditHistoryText)
                : { status: 'GOOD' as const, matchedPhrase: null };
            const debt = creditHistoryText
                ? extractExistingMonthlyDebt(creditHistoryText)
                : { averageAmount: 0, totalAmount: 0, matchesFound: 0 };
            const pension = pensionText
                ? extractAvgMonthlyPension(pensionText)
                : { averageAmount: 0, totalAmount: 0, matchesFound: 0 };

            const creditHistoryStatus = creditHistory.status;
            const avgMonthlyPension = pension.averageAmount;
            const existingMonthlyDebt = debt.totalAmount;

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

            res.status(201).json({
                ...scoring,
                matchedPrograms,
                extraction: {
                    creditHistoryDetected: Boolean(creditHistoryFile),
                    creditHistoryMatchedPhrase: creditHistory.matchedPhrase,
                    pensionDetected: Boolean(pensionFile),
                    pensionEntriesFound: pension.matchesFound,
                    debtEntriesFound: debt.matchesFound,
                },
            });
        } catch (error) {
            console.error('Create scoring error:', error);
            res.status(500).json({ error: 'Ошибка расчёта скоринга' });
        }
    }
);

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
