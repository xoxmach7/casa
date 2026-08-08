// Дублирует FixationStatus из delivery/backend/src/lib/fixation.service.ts —
// между фронтендом и бэкендом нет общего пакета типов, держать в синхроне вручную.
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

export const HAPPY_PATH_STEP_LABELS = ['Отправлено', 'Подтверждено', 'Бронь', 'Сделка'] as const;

const STATUS_TO_STEP: Record<FixationStatus, number> = {
  DRAFT: 0,
  SENT: 0,
  DUPLICATE_CHECK: 0,
  CONFIRMED: 1,
  BOOKING_REQUESTED: 2,
  BOOKED: 2,
  DEAL: 3,
  REJECTED_DUPLICATE: -1,
  REJECTED_OTHER: -1,
  EXPIRED: -1,
  CANCELLED: -1,
};

// -1 = терминальный отрицательный статус (не на хэппи-пути степпера).
export function stepForStatus(status: FixationStatus): number {
  return STATUS_TO_STEP[status];
}

const NEXT_HAPPY_STATUS: Partial<Record<FixationStatus, FixationStatus>> = {
  DRAFT: 'SENT',
  SENT: 'DUPLICATE_CHECK',
  DUPLICATE_CHECK: 'CONFIRMED',
  CONFIRMED: 'BOOKING_REQUESTED',
  BOOKING_REQUESTED: 'BOOKED',
  BOOKED: 'DEAL',
};

export function nextHappyStatus(status: FixationStatus): FixationStatus | null {
  return NEXT_HAPPY_STATUS[status] ?? null;
}

const NEXT_ACTION_LABEL: Partial<Record<FixationStatus, string>> = {
  DUPLICATE_CHECK: 'Подтвердить',
  CONFIRMED: 'В бронь',
  BOOKING_REQUESTED: 'Бронь подтверждена',
  BOOKED: 'Оформить сделку',
};

export function nextActionLabel(status: FixationStatus): string | null {
  return NEXT_ACTION_LABEL[status] ?? null;
}

export function isTerminal(status: FixationStatus): boolean {
  return nextHappyStatus(status) === null;
}

const STATUS_LABELS: Record<FixationStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Отправлено',
  DUPLICATE_CHECK: 'Отправлено',
  CONFIRMED: 'Подтверждено',
  BOOKING_REQUESTED: 'В брони',
  BOOKED: 'Забронировано',
  DEAL: 'Сделка',
  REJECTED_DUPLICATE: 'Отклонено (дубликат)',
  REJECTED_OTHER: 'Отклонено',
  EXPIRED: 'Истекло',
  CANCELLED: 'Отменено',
};

export function statusLabel(status: FixationStatus): string {
  return STATUS_LABELS[status];
}
