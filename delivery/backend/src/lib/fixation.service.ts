// Pure state-machine rules for Fixation transitions (ТЗ раздел 8).

export type FixationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'DUPLICATE_CHECK'
  | 'CONFIRMED'
  | 'REJECTED_DUPLICATE'
  | 'REJECTED_OTHER'
  | 'EXPIRED'
  | 'BOOKING_REQUESTED'
  | 'BOOKED'
  | 'DEAL'
  | 'CANCELLED';

export const ALLOWED_TRANSITIONS: Record<FixationStatus, FixationStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['DUPLICATE_CHECK', 'EXPIRED', 'CANCELLED'],
  DUPLICATE_CHECK: ['CONFIRMED', 'REJECTED_DUPLICATE', 'REJECTED_OTHER', 'CANCELLED'],
  CONFIRMED: ['BOOKING_REQUESTED', 'CANCELLED'],
  BOOKING_REQUESTED: ['BOOKED', 'CANCELLED'],
  BOOKED: ['DEAL', 'CANCELLED'],
  DEAL: [],
  REJECTED_DUPLICATE: [],
  REJECTED_OTHER: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(from: FixationStatus, to: FixationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: FixationStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
