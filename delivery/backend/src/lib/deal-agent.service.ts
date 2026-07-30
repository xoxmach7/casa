// ИИ-риелтор (MVP): деterministic rule engine that watches active deals,
// flags ones stuck on a stage too long, and suggests (never силой applies)
// the next Kanban stage. Deliberately NOT auto-moving deals — "ready to
// advance" isn't reliably inferable from current data (no linked documents/
// payment confirmations), so a wrong auto-move could misrepresent a real
// financial transaction. Only the time-based "stalled" signal is objective
// enough to act on without a human in the loop.

export type DealStageLike = 'CONSULTATION' | 'CONTRACT' | 'PROMOTION' | 'SHOWINGS';

export interface DealForEvaluation {
  id: string;
  stage: DealStageLike;
  stageChangedAt: Date;
  notes: string | null;
  clientId: string | null;
}

export type DealAgentFinding =
  | { kind: 'STALLED'; daysInStage: number; reason: string }
  | { kind: 'STAGE_SUGGESTED'; suggestedStage: DealStageLike; reason: string }
  | { kind: 'MISSING_INFO'; reason: string };

// Funnel order — mirrors the Kanban column order in DealStage.
const STAGE_ORDER: DealStageLike[] = ['CONSULTATION', 'CONTRACT', 'PROMOTION', 'SHOWINGS'];

// How many days a deal can sit on a stage before it's considered stalled.
const STAGE_STALL_THRESHOLD_DAYS: Record<DealStageLike, number> = {
  CONSULTATION: 5,
  CONTRACT: 10,
  PROMOTION: 14,
  SHOWINGS: 7,
};

const STAGE_LABELS: Record<DealStageLike, string> = {
  CONSULTATION: 'Консультация',
  CONTRACT: 'Договор',
  PROMOTION: 'Продвижение',
  SHOWINGS: 'Показы',
};

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function nextStage(stage: DealStageLike): DealStageLike | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function evaluateDeal(deal: DealForEvaluation, now: Date): DealAgentFinding[] {
  const findings: DealAgentFinding[] = [];
  const daysInStage = daysBetween(deal.stageChangedAt, now);
  const threshold = STAGE_STALL_THRESHOLD_DAYS[deal.stage];

  if (daysInStage > threshold) {
    findings.push({
      kind: 'STALLED',
      daysInStage,
      reason: `Сделка находится на этапе «${STAGE_LABELS[deal.stage]}» уже ${daysInStage} дн. (обычно не дольше ${threshold} дн.) — нужна проверка.`,
    });

    const suggested = nextStage(deal.stage);
    if (suggested) {
      findings.push({
        kind: 'STAGE_SUGGESTED',
        suggestedStage: suggested,
        reason: `Если условия для этапа «${STAGE_LABELS[deal.stage]}» выполнены, рассмотрите перевод на «${STAGE_LABELS[suggested]}».`,
      });
    }
  }

  if (!deal.clientId && !deal.notes) {
    findings.push({
      kind: 'MISSING_INFO',
      reason: 'У сделки не указан клиент и нет заметок — заполните карточку, чтобы агент мог отслеживать прогресс.',
    });
  }

  return findings;
}
