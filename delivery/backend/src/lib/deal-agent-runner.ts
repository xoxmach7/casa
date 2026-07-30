// Shared runner for the deal-watching agent — called both from the manual
// POST /api/deals/agent/run route and the hourly scheduler in index.ts, so
// the two never drift out of sync.
//
// Batches its DB work in three passes (findings computed in-memory -> one
// bulk read of prior actions -> one bulk write) instead of a per-deal
// findFirst+create+create loop, since this runs against every IN_PROGRESS
// deal on every invocation (hourly, plus on-demand).

import { prisma } from './prisma';
import { evaluateDeal, DealStageLike } from './deal-agent.service';
import { DealAgentActionType, DealStage } from '@prisma/client';

export interface DealAgentRunStats {
  checkedDeals: number;
  stalledCount: number;
  suggestedCount: number;
  missingInfoCount: number;
}

interface PendingAction {
  dealId: string;
  actionType: DealAgentActionType;
  fromStage: DealStage;
  toStage: DealStage | null;
  reason: string;
  brokerId: string;
  notificationTitle: string;
}

export async function runDealAgent(): Promise<DealAgentRunStats> {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true, stage: true, stageChangedAt: true, notes: true, clientId: true, brokerId: true },
  });

  let missingInfoCount = 0;
  const pending: PendingAction[] = [];

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

      if (finding.kind === 'STALLED') {
        pending.push({
          dealId: deal.id,
          actionType: 'STALLED_ALERT',
          fromStage: deal.stage,
          toStage: null,
          reason: finding.reason,
          brokerId: deal.brokerId,
          notificationTitle: 'Сделка зависла на этапе',
        });
      } else {
        pending.push({
          dealId: deal.id,
          actionType: 'STAGE_SUGGESTED',
          fromStage: deal.stage,
          toStage: finding.suggestedStage,
          reason: finding.reason,
          brokerId: deal.brokerId,
          notificationTitle: 'Предложение по сделке',
        });
      }
    }
  }

  if (pending.length === 0) {
    return { checkedDeals: deals.length, stalledCount: 0, suggestedCount: 0, missingInfoCount };
  }

  const stageChangedAtByDeal = new Map(deals.map((d) => [d.id, d.stageChangedAt]));
  const oldestStageChange = deals.reduce<Date | null>(
    (min, d) => (min === null || d.stageChangedAt < min ? d.stageChangedAt : min),
    null
  );

  // One bulk read covering every deal/action-type we might skip, instead of
  // a findFirst per finding. The per-deal de-dup cutoff (stageChangedAt) is
  // still applied in memory below since it differs deal-by-deal.
  const priorActions = await prisma.dealAgentAction.findMany({
    where: {
      dealId: { in: [...new Set(pending.map((p) => p.dealId))] },
      actionType: { in: ['STALLED_ALERT', 'STAGE_SUGGESTED'] },
      ...(oldestStageChange ? { createdAt: { gte: oldestStageChange } } : {}),
    },
    select: { dealId: true, actionType: true, createdAt: true },
  });

  const alreadyLogged = new Set(
    priorActions
      .filter((a) => {
        const cutoff = stageChangedAtByDeal.get(a.dealId);
        return cutoff ? a.createdAt >= cutoff : false;
      })
      .map((a) => `${a.dealId}:${a.actionType}`)
  );

  const toApply = pending.filter((p) => !alreadyLogged.has(`${p.dealId}:${p.actionType}`));

  if (toApply.length > 0) {
    await prisma.dealAgentAction.createMany({
      data: toApply.map((p) => ({
        dealId: p.dealId,
        actionType: p.actionType,
        fromStage: p.fromStage,
        toStage: p.toStage ?? undefined,
        reason: p.reason,
      })),
    });
    await prisma.notification.createMany({
      data: toApply.map((p) => ({
        userId: p.brokerId,
        type: 'DEAL' as const,
        title: p.notificationTitle,
        message: p.reason,
      })),
    });
  }

  const stalledCount = toApply.filter((p) => p.actionType === 'STALLED_ALERT').length;
  const suggestedCount = toApply.filter((p) => p.actionType === 'STAGE_SUGGESTED').length;

  return { checkedDeals: deals.length, stalledCount, suggestedCount, missingInfoCount };
}
