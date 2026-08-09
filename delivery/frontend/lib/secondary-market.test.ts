import { describe, it, expect } from 'vitest';
import {
  DEAL_ROOM_PHASES,
  blockerLabel,
  dealRoomStageLabel,
  depositStatusLabel,
  formatRange,
  formatTenge,
  phaseForStage,
  scaleLabel,
  trafficLightClass,
  valuationNeedsAttention,
  valuationStatusLabel,
  type DealRoomStage,
} from './secondary-market';

const ALL_STAGES: DealRoomStage[] = [
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
  'FAILED',
];

const ALL_VALUATION_STATUSES = [
  'SUBMITTED',
  'PRELIMINARY_CALCULATION',
  'PRELIMINARY_READY',
  'MANUAL_REVIEW_REQUIRED',
  'COMPARABLE_COLLECTION',
  'HUMAN_REVIEW',
  'CONFIRMED',
  'ACCEPTED',
  'ACCEPTED_WITH_PRICE_CONDITION',
  'REJECTED',
];

describe('dealRoomStageLabel', () => {
  it('translates every stage the backend can return', () => {
    for (const stage of ALL_STAGES) {
      const label = dealRoomStageLabel(stage);
      expect(label).toBeTruthy();
      expect(label).not.toBe(stage);
    }
  });

  it('falls back to the raw code rather than rendering nothing', () => {
    expect(dealRoomStageLabel('SOME_NEW_STAGE')).toBe('SOME_NEW_STAGE');
  });
});

describe('DEAL_ROOM_PHASES', () => {
  it('covers every stage exactly once — no deal can fall off the board', () => {
    const placed = DEAL_ROOM_PHASES.flatMap((p) => p.stages);
    expect([...placed].sort()).toEqual([...ALL_STAGES].sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('keeps the deposit phase after the green gates', () => {
    const keys = DEAL_ROOM_PHASES.map((p) => p.key);
    expect(keys.indexOf('deposit')).toBeGreaterThan(keys.indexOf('precheck'));
  });

  it('maps a stage back to its phase', () => {
    expect(phaseForStage('GREEN_2')).toBe('precheck');
    expect(phaseForStage('SOLD')).toBe('outcome');
    expect(phaseForStage('NOT_A_STAGE')).toBeNull();
  });
});

describe('trafficLightClass', () => {
  it('distinguishes all four lights', () => {
    const classes = ['RED', 'YELLOW', 'GREEN_1', 'GREEN_2'].map(trafficLightClass);
    expect(new Set(classes).size).toBe(4);
  });

  it('treats an unknown light as red rather than rendering unstyled', () => {
    expect(trafficLightClass('WHATEVER')).toBe(trafficLightClass('RED'));
  });
});

describe('valuationStatusLabel', () => {
  it('translates every status', () => {
    for (const status of ALL_VALUATION_STATUSES) {
      expect(valuationStatusLabel(status)).not.toBe(status);
    }
  });
});

describe('valuationNeedsAttention', () => {
  it('flags exactly the statuses that are waiting on a person', () => {
    expect(valuationNeedsAttention('MANUAL_REVIEW_REQUIRED')).toBe(true);
    expect(valuationNeedsAttention('HUMAN_REVIEW')).toBe(true);
    expect(valuationNeedsAttention('PRELIMINARY_READY')).toBe(true);
  });

  it('does not flag machine steps or finished decisions', () => {
    for (const status of ['SUBMITTED', 'PRELIMINARY_CALCULATION', 'ACCEPTED', 'REJECTED']) {
      expect(valuationNeedsAttention(status)).toBe(false);
    }
  });
});

describe('blockerLabel', () => {
  it('explains the server blocker codes in Russian', () => {
    expect(blockerLabel('green_2_required')).toContain('Green 2');
    expect(blockerLabel('coordinator_verification_required')).toContain('координатор');
  });

  it('shows the raw code when the backend adds a new one', () => {
    expect(blockerLabel('brand_new_blocker')).toBe('brand_new_blocker');
  });
});

describe('depositStatusLabel and scaleLabel', () => {
  it('spells out the deposit lifecycle', () => {
    expect(depositStatusLabel('NOT_ALLOWED')).toContain('Green 2');
    expect(depositStatusLabel('SIGNED')).toBe('Договор подписан');
  });

  it('renders an absent scale as a dash, not as "null"', () => {
    expect(scaleLabel(null)).toBe('—');
    expect(scaleLabel(undefined)).toBe('—');
    expect(scaleLabel('HIGH')).toBe('Высокая');
  });
});

describe('formatTenge', () => {
  it('groups digits and appends the tenge sign', () => {
    // Intl uses a non-breaking space as the group separator.
    expect(formatTenge(16047545).replace(/ /g, ' ')).toBe('16 047 545 ₸');
  });

  it('accepts the decimal strings Prisma returns', () => {
    expect(formatTenge('2500000.00').replace(/ /g, ' ')).toBe('2 500 000 ₸');
  });

  it('renders missing or unparseable amounts as a dash', () => {
    expect(formatTenge(null)).toBe('—');
    expect(formatTenge(undefined)).toBe('—');
    expect(formatTenge('')).toBe('—');
    expect(formatTenge('not a number')).toBe('—');
  });

  it('does not turn a real zero into a dash', () => {
    expect(formatTenge(0)).toBe('0 ₸');
  });
});

describe('formatRange', () => {
  it('renders both ends when both are known', () => {
    expect(formatRange(1000, 2000).replace(/ /g, ' ')).toBe('1 000 ₸ — 2 000 ₸');
  });

  it('renders the single known end instead of a half-empty range', () => {
    expect(formatRange(1000, null).replace(/ /g, ' ')).toBe('1 000 ₸');
    expect(formatRange(null, 2000).replace(/ /g, ' ')).toBe('2 000 ₸');
  });

  it('renders a dash when nothing is known', () => {
    expect(formatRange(null, null)).toBe('—');
  });
});
