// Ярлыки и группировки для контура вторички (Deal Room + Оценка).
// Дублируют enum'ы из delivery/backend/prisma/schema.prisma — общего пакета
// типов между фронтом и бэком нет, держать в синхроне вручную (так же, как
// fixation-status.ts).

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

const DEAL_ROOM_STAGE_LABELS: Record<DealRoomStage, string> = {
  OFFER_SUBMITTED: 'Оффер подан',
  SELLER_REVIEW: 'На рассмотрении продавца',
  COUNTEROFFER_SENT: 'Встречное предложение',
  PRICE_AGREED: 'Цена согласована',
  PRECHECK_IN_PROGRESS: 'Проверка документов',
  YELLOW_BLOCKED: 'Есть блокеры',
  GREEN_1: 'Green 1 — базовая проверка',
  GREEN_2: 'Green 2 — оплата подтверждена',
  DEPOSIT_AGREEMENT_DRAFTING: 'Договор задатка: черновик',
  DEPOSIT_AGREEMENT_SENT: 'Договор задатка отправлен',
  DEPOSIT_AGREEMENT_SIGNED: 'Договор задатка подписан',
  DEPOSIT_TRANSFER_PENDING: 'Ожидание перевода задатка',
  BOOKING_ACTIVE: 'Бронь активна',
  PAYMENT_ROUTE_IN_PROGRESS: 'Оплата в процессе',
  READY_FOR_NOTARY: 'Готово к нотариусу',
  NOTARY_SCHEDULED: 'Нотариус назначен',
  REGISTRATION_OR_DISBURSEMENT: 'Регистрация и выдача денег',
  SOLD: 'Продано',
  FAILED: 'Сделка сорвалась',
};

export function dealRoomStageLabel(stage: string): string {
  return DEAL_ROOM_STAGE_LABELS[stage as DealRoomStage] ?? stage;
}

/** Фазы сделки — колонки доски. Порядок соответствует каноническому пути. */
export const DEAL_ROOM_PHASES: { key: string; title: string; stages: DealRoomStage[] }[] = [
  {
    key: 'negotiation',
    title: 'Переговоры',
    stages: ['OFFER_SUBMITTED', 'SELLER_REVIEW', 'COUNTEROFFER_SENT', 'PRICE_AGREED'],
  },
  {
    key: 'precheck',
    title: 'Проверка',
    stages: ['PRECHECK_IN_PROGRESS', 'YELLOW_BLOCKED', 'GREEN_1', 'GREEN_2'],
  },
  {
    key: 'deposit',
    title: 'Задаток',
    stages: [
      'DEPOSIT_AGREEMENT_DRAFTING',
      'DEPOSIT_AGREEMENT_SENT',
      'DEPOSIT_AGREEMENT_SIGNED',
      'DEPOSIT_TRANSFER_PENDING',
    ],
  },
  {
    key: 'closing',
    title: 'Выход на сделку',
    stages: [
      'BOOKING_ACTIVE',
      'PAYMENT_ROUTE_IN_PROGRESS',
      'READY_FOR_NOTARY',
      'NOTARY_SCHEDULED',
      'REGISTRATION_OR_DISBURSEMENT',
    ],
  },
  { key: 'outcome', title: 'Итог', stages: ['SOLD', 'FAILED'] },
];

export function phaseForStage(stage: string): string | null {
  return DEAL_ROOM_PHASES.find((p) => p.stages.includes(stage as DealRoomStage))?.key ?? null;
}

export type TrafficLight = 'RED' | 'YELLOW' | 'GREEN_1' | 'GREEN_2';

const TRAFFIC_LIGHT_LABELS: Record<TrafficLight, string> = {
  RED: 'Красный',
  YELLOW: 'Жёлтый',
  GREEN_1: 'Green 1',
  GREEN_2: 'Green 2',
};

export function trafficLightLabel(light: string): string {
  return TRAFFIC_LIGHT_LABELS[light as TrafficLight] ?? light;
}

/** Классы бейджа светофора. Красный и жёлтый — это состояния, требующие работы. */
export function trafficLightClass(light: string): string {
  switch (light) {
    case 'GREEN_2':
      return 'bg-emerald-600 text-white hover:bg-emerald-600';
    case 'GREEN_1':
      return 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200';
    case 'YELLOW':
      return 'bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200';
    default:
      return 'bg-red-100 text-red-900 hover:bg-red-100 dark:bg-red-950 dark:text-red-200';
  }
}

export type ValuationStatus =
  | 'SUBMITTED'
  | 'PRELIMINARY_CALCULATION'
  | 'PRELIMINARY_READY'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'COMPARABLE_COLLECTION'
  | 'HUMAN_REVIEW'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'ACCEPTED_WITH_PRICE_CONDITION'
  | 'REJECTED';

const VALUATION_STATUS_LABELS: Record<ValuationStatus, string> = {
  SUBMITTED: 'Заявка принята',
  PRELIMINARY_CALCULATION: 'Идёт предварительный расчёт',
  PRELIMINARY_READY: 'Предварительная оценка готова',
  MANUAL_REVIEW_REQUIRED: 'Нужен ручной разбор',
  COMPARABLE_COLLECTION: 'Сбор аналогов',
  HUMAN_REVIEW: 'На проверке специалиста',
  CONFIRMED: 'Подтверждено',
  ACCEPTED: 'Принято',
  ACCEPTED_WITH_PRICE_CONDITION: 'Принято с условием по цене',
  REJECTED: 'Отклонено',
};

export function valuationStatusLabel(status: string): string {
  return VALUATION_STATUS_LABELS[status as ValuationStatus] ?? status;
}

/** Статусы, где заявка ждёт человека, а не машины — их подсвечиваем в очереди. */
export function valuationNeedsAttention(status: string): boolean {
  return status === 'MANUAL_REVIEW_REQUIRED' || status === 'HUMAN_REVIEW' || status === 'PRELIMINARY_READY';
}

const COMPARABLE_COMPATIBILITY_LABELS: Record<string, string> = {
  DIRECT: 'Прямой аналог',
  CLOSE: 'Близкий',
  MARKET_CONTEXT: 'Рыночный контекст',
};

export function comparabilityLabel(value: string): string {
  return COMPARABLE_COMPATIBILITY_LABELS[value] ?? value;
}

const SCALE_LABELS: Record<string, string> = { LOW: 'Низкая', MEDIUM: 'Средняя', HIGH: 'Высокая' };

export function scaleLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return SCALE_LABELS[value] ?? value;
}

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  NOT_ALLOWED: 'Запрещён (нет Green 2)',
  DRAFTING: 'Черновик договора',
  SENT: 'Договор отправлен',
  SIGNED: 'Договор подписан',
  TRANSFER_PENDING: 'Перевод подтверждён координатором',
  RECEIVED: 'Получен',
  CANCELLED: 'Отменён',
};

export function depositStatusLabel(status: string): string {
  return DEPOSIT_STATUS_LABELS[status] ?? status;
}

// Действия из AuditLog. Пишутся туда кодом бэкенда — здесь переводятся для
// ленты истории, чтобы пользователь не читал CALCULATE_PRELIMINARY.
const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Заявка создана',
  CONFIRM: 'Оценка подтверждена',
  CALCULATE_PRELIMINARY: 'Предварительный расчёт',
  ADD_COMPARABLE: 'Добавлен аналог',
  OPEN_DEAL_ROOM: 'Комната сделки открыта',
  TRANSITION: 'Переход по стадии',
  VERIFY_DEPOSIT_TRANSFER: 'Перевод задатка подтверждён',
  CLOSE: 'Закрыто',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const RISK_CATEGORY_LABELS: Record<string, string> = {
  legal: 'Юридический риск',
  documents: 'Документы',
  encumbrance: 'Обременение',
  payment: 'Оплата',
  mortgage: 'Ипотека',
  seller: 'Продавец',
  buyer: 'Покупатель',
  timing: 'Сроки',
};

export function riskCategoryLabel(category: string): string {
  return RISK_CATEGORY_LABELS[category] ?? category;
}

/** Человекочитаемые причины, по которым сервер отказывает в переходе. */
const BLOCKER_LABELS: Record<string, string> = {
  invalid_transition: 'Такой переход не предусмотрен процессом',
  open_blocking_risk: 'Есть незакрытый блокирующий риск',
  payment_route_unclear: 'Источник оплаты не подтверждён',
  missing_amount_gt_zero: 'Не хватает суммы по сделке',
  mortgage_part_unconfirmed: 'Ипотечная часть не подтверждена',
  green_2_required: 'Задаток нельзя готовить до Green 2',
  deposit_not_signed_or_transferred: 'Договор задатка не подписан или деньги не переведены',
  missing_transfer_proof: 'Нет подтверждения перевода',
  coordinator_verification_required: 'Нужна проверка координатором',
  final_checklist_incomplete: 'Финальный чек-лист не заполнен',
  open_blocker: 'Есть открытый блокер',
  active_deal_exists: 'По этой паре объект + покупатель уже есть активная сделка',
  version_immutable: 'Версия уже подтверждена и не редактируется',
  insufficient_comparables: 'Недостаточно аналогов',
};

export function blockerLabel(code: string): string {
  return BLOCKER_LABELS[code] ?? code;
}

/** Суммы в тенге. Дробная часть в ценах на недвижимость только мешает. */
export function formatTenge(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)} ₸`;
}

export function formatRange(
  low: number | string | null | undefined,
  high: number | string | null | undefined
): string {
  if (low == null && high == null) return '—';
  if (low != null && high != null) return `${formatTenge(low)} — ${formatTenge(high)}`;
  return formatTenge(low ?? high);
}
