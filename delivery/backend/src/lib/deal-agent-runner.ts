// Shared runner for the deal-watching agent — called both from the manual
// POST /api/deals/agent/run route and the hourly scheduler in index.ts, so
// the two never drift out of sync.

import { prisma } from './prisma';
import { evaluateDeal, DealStageLike } from './deal-agent.service';

export interface DealAgentRunStats {
  checkedDeals: number;
  stalledCount: number;
  suggestedCount: number;
  missingInfoCount: number;
}

export async function runDealAgent(): Promise<DealAgentRunStats> {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true, stage: true, stageChangedAt: true, notes: true, clientId: true, brokerId: true },
  });

  let stalledCount = 0;
  let suggestedCount = 0;
  let missingInfoCount = 0;

  for (const deal of deals) {
    const findings = evaluateDeal(
      {
        id: deal.id,
        stage: deal.stage as DealStageLike,
        stageChangedAt: deal.stageChangedAt,
        notes: deal.notes,
        clientId: deal.clientId,
      },
      now
    );

    for (const finding of findings) {
      if (finding.kind === 'MISSING_INFO') {
        missingInfoCount++;
        continue; // информационная пометка, без уведомления/спама на каждый прогон
      }

      // Не повторяем одно и то же предложение, пока сделка не сменила этап
      const alreadyLogged = await prisma.dealAgentAction.findFirst({
        where: {
          dealId: deal.id,
          actionType: finding.kind === 'STALLED' ? 'STALLED_ALERT' : 'STAGE_SUGGESTED',
          createdAt: { gte: deal.stageChangedAt },
        },
      });
      if (alreadyLogged) continue;

      if (finding.kind === 'STALLED') {
        stalledCount++;
        await prisma.dealAgentAction.create({
          data: {
            dealId: deal.id,
            actionType: 'STALLED_ALERT',
            fromStage: deal.stage,
            reason: finding.reason,
          },
        });
        await prisma.notification.create({
          data: {
            userId: deal.brokerId,
            type: 'DEAL',
            title: 'Сделка зависла на этапе',
            message: finding.reason,
          },
        });
      } else if (finding.kind === 'STAGE_SUGGESTED') {
        suggestedCount++;
        await prisma.dealAgentAction.create({
          data: {
            dealId: deal.id,
            actionType: 'STAGE_SUGGESTED',
            fromStage: deal.stage,
            toStage: finding.suggestedStage,
            reason: finding.reason,
          },
        });
        await prisma.notification.create({
          data: {
            userId: deal.brokerId,
            type: 'DEAL',
            title: 'Предложение по сделке',
            message: finding.reason,
          },
        });
      }
    }
  }

  return { checkedDeals: deals.length, stalledCount, suggestedCount, missingInfoCount };
}
