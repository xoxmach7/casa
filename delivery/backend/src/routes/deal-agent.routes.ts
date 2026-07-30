// =========================================
// ИИ-РИЕЛТОР (CASA CRM)
// Наблюдает за активными сделками, помечает зависшие на этапе дольше нормы
// и предлагает следующий этап воронки. Никогда не двигает сделку сам —
// только уведомляет брокера и пишет предложение в журнал (DealAgentAction),
// чтобы решение оставалось за человеком. См. deal-agent.service.ts.
// =========================================

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { runDealAgent } from '../lib/deal-agent-runner';

export const dealAgentRouter = Router();
dealAgentRouter.use(authenticate);

// POST /api/deals/agent/run - прогнать агента по всем активным сделкам вручную
// (тот же прогон выполняется автоматически раз в час — см. index.ts)
dealAgentRouter.post('/run', requireRole('ADMIN'), async (_req: Request, res: Response): Promise<void> => {
    try {
        const stats = await runDealAgent();
        res.json(stats);
    } catch (error) {
        console.error('Deal agent run error:', error);
        res.status(500).json({ error: 'Ошибка запуска агента по сделкам' });
    }
});

// GET /api/deals/agent/log/:dealId - журнал действий агента по конкретной сделке
dealAgentRouter.get('/log/:dealId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { dealId } = req.params;
        const deal = await prisma.deal.findUnique({ where: { id: dealId } });
        if (!deal) {
            res.status(404).json({ error: 'Сделка не найдена' });
            return;
        }

        const restrictedRoles = ['BROKER', 'REALTOR', 'AGENCY'];
        if (restrictedRoles.includes(req.user?.role || '') && deal.brokerId !== req.user!.userId) {
            res.status(403).json({ error: 'Доступ запрещен' });
            return;
        }

        const actions = await prisma.dealAgentAction.findMany({
            where: { dealId },
            orderBy: { createdAt: 'desc' },
        });

        res.json(actions);
    } catch (error) {
        console.error('Deal agent log error:', error);
        res.status(500).json({ error: 'Ошибка получения журнала агента' });
    }
});
