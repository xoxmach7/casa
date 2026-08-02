// Pure state-machine + scheduling-guard rules for the canonical Viewing
// (Show) flow — CASA Developer Handoff v2.0, 03_CASA_Showings_Spec section 6-7.
// Legacy statuses (SCHEDULED/COMPLETED/CANCELLED) are intentionally excluded
// from this state machine — existing routes keep using them as-is until
// they're migrated onto this canonical set (see gap-audit).

export type CanonicalShowStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'AWAITING_SELLER_CONFIRMATION'
  | 'CONFIRMED'
  | 'RESCHEDULE_REQUESTED'
  | 'COMPLETED'
  | 'NO_SHOW_BUYER'
  | 'NO_SHOW_SELLER'
  | 'CANCELLED'
  | 'EXPIRED';

export const ALLOWED_SHOW_TRANSITIONS: Record<CanonicalShowStatus, CanonicalShowStatus[]> = {
  DRAFT: ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['AWAITING_SELLER_CONFIRMATION', 'CANCELLED'],
  AWAITING_SELLER_CONFIRMATION: ['CONFIRMED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'NO_SHOW_BUYER', 'NO_SHOW_SELLER'],
  RESCHEDULE_REQUESTED: ['AWAITING_SELLER_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  COMPLETED: [],
  NO_SHOW_BUYER: [],
  NO_SHOW_SELLER: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionShow(from: CanonicalShowStatus, to: CanonicalShowStatus): boolean {
  return ALLOWED_SHOW_TRANSITIONS[from].includes(to);
}

// Legacy ShowStatus values (SCHEDULED/COMPLETED/CANCELLED) predate the
// canonical set and still exist in the DB/live routes — map them onto their
// canonical equivalent so the guard above can apply to both without a data
// migration. Values already in the canonical set map to themselves.
export type LegacyOrCanonicalShowStatus = CanonicalShowStatus | 'SCHEDULED';

export function toCanonicalShowStatus(status: LegacyOrCanonicalShowStatus): CanonicalShowStatus {
  return status === 'SCHEDULED' ? 'CONFIRMED' : status;
}

export function isTerminalShowStatus(status: CanonicalShowStatus): boolean {
  return ALLOWED_SHOW_TRANSITIONS[status].length === 0;
}

// Раздел 7 спеки: подтверждённый показ не может пересекаться с другим
// confirmed-показом того же объекта/менеджера с учётом буфера (по умолчанию
// 30 минут — showings.buffer_minutes, конфигурируется через ConfigVersion).
export interface ConfirmedSlot {
  confirmedStartAt: Date;
  confirmedEndAt: Date;
}

export function hasSchedulingConflict(
  existingConfirmedSlots: ConfirmedSlot[],
  candidateStart: Date,
  candidateEnd: Date,
  bufferMinutes = 30
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  return existingConfirmedSlots.some((slot) => {
    const paddedStart = new Date(slot.confirmedStartAt.getTime() - bufferMs);
    const paddedEnd = new Date(slot.confirmedEndAt.getTime() + bufferMs);
    return candidateStart < paddedEnd && candidateEnd > paddedStart;
  });
}

// Раздел 7: "Подтверждение после истечения proposed slot запрещено; нужен
// новый слот."
export function canConfirmSlot(proposedEndAt: Date, confirmAt: Date): boolean {
  return confirmAt <= proposedEndAt;
}
