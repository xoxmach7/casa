// Pure state-machine + server-side guards for the Deal Room (SecondaryDeal) —
// CASA Developer Handoff v2.0, 04_CASA_Deal_Room_Spec section 2, 4, 6, 7.
// "Непереговорные правила": price_agreed ≠ booking. Green 1 ≠ разрешение на
// задаток. Green 2 разрешает только подготовку договора. booking_active
// требует signed deposit + proof of transfer + coordinator verification.
// CASA не принимает задаток.

export type DealRoomStage =
  | 'OFFER_SUBMITTED'
  | 'SELLER_REVIEW'
  | 'COUNTEROFFER_SENT'
  | 'PRICE_AGREED'
  | 'PRECHECK_IN_PROGRESS'
  | 'YELLOW_BLOCKED'
  | 'GREEN_1'
  | 'GREEN_2'
  | 'DEPOSIT_AGREEMENT_DRAFTING'
  | 'DEPOSIT_AGREEMENT_SENT'
  | 'DEPOSIT_AGREEMENT_SIGNED'
  | 'DEPOSIT_TRANSFER_PENDING'
  | 'BOOKING_ACTIVE'
  | 'PAYMENT_ROUTE_IN_PROGRESS'
  | 'READY_FOR_NOTARY'
  | 'NOTARY_SCHEDULED'
  | 'REGISTRATION_OR_DISBURSEMENT'
  | 'SOLD'
  | 'FAILED';

// Раздел 2 канонический путь. FAILED достижим почти из любой не-терминальной
// стадии (сделка может сорваться на любом этапе) — моделируем явно.
export const ALLOWED_DEAL_ROOM_TRANSITIONS: Record<DealRoomStage, DealRoomStage[]> = {
  OFFER_SUBMITTED: ['SELLER_REVIEW', 'FAILED'],
  SELLER_REVIEW: ['COUNTEROFFER_SENT', 'PRICE_AGREED', 'FAILED'],
  COUNTEROFFER_SENT: ['PRICE_AGREED', 'FAILED'],
  PRICE_AGREED: ['PRECHECK_IN_PROGRESS', 'FAILED'],
  PRECHECK_IN_PROGRESS: ['YELLOW_BLOCKED', 'GREEN_1', 'FAILED'],
  YELLOW_BLOCKED: ['PRECHECK_IN_PROGRESS', 'GREEN_1', 'FAILED'],
  GREEN_1: ['GREEN_2', 'FAILED'],
  GREEN_2: ['DEPOSIT_AGREEMENT_DRAFTING', 'FAILED'],
  DEPOSIT_AGREEMENT_DRAFTING: ['DEPOSIT_AGREEMENT_SENT', 'FAILED'],
  DEPOSIT_AGREEMENT_SENT: ['DEPOSIT_AGREEMENT_SIGNED', 'FAILED'],
  DEPOSIT_AGREEMENT_SIGNED: ['DEPOSIT_TRANSFER_PENDING', 'FAILED'],
  DEPOSIT_TRANSFER_PENDING: ['BOOKING_ACTIVE', 'FAILED'],
  BOOKING_ACTIVE: ['PAYMENT_ROUTE_IN_PROGRESS', 'FAILED'],
  PAYMENT_ROUTE_IN_PROGRESS: ['READY_FOR_NOTARY', 'FAILED'],
  READY_FOR_NOTARY: ['NOTARY_SCHEDULED', 'FAILED'],
  NOTARY_SCHEDULED: ['REGISTRATION_OR_DISBURSEMENT', 'FAILED'],
  REGISTRATION_OR_DISBURSEMENT: ['SOLD', 'FAILED'],
  SOLD: [],
  FAILED: [],
};

export function canTransitionDealRoom(from: DealRoomStage, to: DealRoomStage): boolean {
  return ALLOWED_DEAL_ROOM_TRANSITIONS[from].includes(to);
}

export function isTerminalDealRoomStage(stage: DealRoomStage): boolean {
  return ALLOWED_DEAL_ROOM_TRANSITIONS[stage].length === 0;
}

// Отдаётся в карточке сделки, чтобы UI не дублировал стейт-машину и не
// предлагал переход, который сервер всё равно отклонит. Гварды Green/задатка
// проверяются отдельно при самом переходе — здесь только форма графа.
export function availableDealRoomTransitions(from: DealRoomStage): DealRoomStage[] {
  return ALLOWED_DEAL_ROOM_TRANSITIONS[from];
}

export interface GuardResult {
  allowed: boolean;
  blockers: string[];
}

function guard(blockers: string[]): GuardResult {
  return { allowed: blockers.length === 0, blockers };
}

// Раздел 4 Green gates + раздел 7 Server-side guards:
// "Green 2 запрещён при открытом blocking risk, неясном источнике оплаты,
// missing_amount>0 или неподтверждённой ипотечной части."
export function canSetGreen2(precheck: {
  hasBlockingRisk: boolean;
  paymentRouteConfirmed: boolean;
  missingAmount: number;
  mortgagePartConfirmed: boolean;
}): GuardResult {
  const blockers: string[] = [];
  if (precheck.hasBlockingRisk) blockers.push('open_blocking_risk');
  if (!precheck.paymentRouteConfirmed) blockers.push('payment_route_unclear');
  if (precheck.missingAmount > 0) blockers.push('missing_amount_gt_zero');
  if (!precheck.mortgagePartConfirmed) blockers.push('mortgage_part_unconfirmed');
  return guard(blockers);
}

// Раздел 7: "Deposit draft запрещён без green_2."
export function canDraftDeposit(currentStage: DealRoomStage): GuardResult {
  return guard(isAtOrPastGreen2(currentStage) ? [] : ['green_2_required']);
}

const STAGE_ORDER: DealRoomStage[] = [
  'OFFER_SUBMITTED',
  'SELLER_REVIEW',
  'COUNTEROFFER_SENT',
  'PRICE_AGREED',
  'PRECHECK_IN_PROGRESS',
  'YELLOW_BLOCKED',
  'GREEN_1',
  'GREEN_2',
  'DEPOSIT_AGREEMENT_DRAFTING',
  'DEPOSIT_AGREEMENT_SENT',
  'DEPOSIT_AGREEMENT_SIGNED',
  'DEPOSIT_TRANSFER_PENDING',
  'BOOKING_ACTIVE',
  'PAYMENT_ROUTE_IN_PROGRESS',
  'READY_FOR_NOTARY',
  'NOTARY_SCHEDULED',
  'REGISTRATION_OR_DISBURSEMENT',
  'SOLD',
];

function isAtOrPastGreen2(stage: DealRoomStage): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  const green2Idx = STAGE_ORDER.indexOf('GREEN_2');
  return idx >= green2Idx;
}

// Раздел 7: "booking_active запрещён без deposit_agreement_signed, transfer
// proof и coordinator_verification=true."
export function canActivateBooking(deposit: {
  status: 'NOT_ALLOWED' | 'DRAFTING' | 'SENT' | 'SIGNED' | 'TRANSFER_PENDING' | 'RECEIVED' | 'CANCELLED';
  proofFileAssetId: string | null;
  coordinatorVerified: boolean;
}): GuardResult {
  const blockers: string[] = [];
  if (deposit.status !== 'TRANSFER_PENDING' && deposit.status !== 'RECEIVED') {
    blockers.push('deposit_not_signed_or_transferred');
  }
  if (!deposit.proofFileAssetId) blockers.push('missing_transfer_proof');
  if (!deposit.coordinatorVerified) blockers.push('coordinator_verification_required');
  return guard(blockers);
}

// Раздел 7: "ready_for_notary/notary_scheduled запрещены без финального
// checklist и при открытом blocker."
export function canProceedToNotary(finalChecklistComplete: boolean, hasOpenBlocker: boolean): GuardResult {
  const blockers: string[] = [];
  if (!finalChecklistComplete) blockers.push('final_checklist_incomplete');
  if (hasOpenBlocker) blockers.push('open_blocker');
  return guard(blockers);
}
