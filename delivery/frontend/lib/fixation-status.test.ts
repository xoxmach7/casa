import { describe, it, expect } from 'vitest';
import {
  HAPPY_PATH_STEP_LABELS,
  isTerminal,
  nextActionLabel,
  nextHappyStatus,
  statusLabel,
  stepForStatus,
  type FixationStatus,
} from './fixation-status';

const ALL_STATUSES: FixationStatus[] = [
  'DRAFT',
  'SENT',
  'DUPLICATE_CHECK',
  'CONFIRMED',
  'REJECTED_DUPLICATE',
  'REJECTED_OTHER',
  'EXPIRED',
  'BOOKING_REQUESTED',
  'BOOKED',
  'DEAL',
  'CANCELLED',
];

describe('stepForStatus', () => {
  it('walks the happy path forward without skipping a step', () => {
    expect(stepForStatus('SENT')).toBe(0);
    expect(stepForStatus('CONFIRMED')).toBe(1);
    expect(stepForStatus('BOOKED')).toBe(2);
    expect(stepForStatus('DEAL')).toBe(3);
  });

  it('marks every negative terminal status as off the stepper', () => {
    for (const status of ['REJECTED_DUPLICATE', 'REJECTED_OTHER', 'EXPIRED', 'CANCELLED'] as const) {
      expect(stepForStatus(status)).toBe(-1);
    }
  });

  it('never returns a step past the last label', () => {
    for (const status of ALL_STATUSES) {
      expect(stepForStatus(status)).toBeLessThan(HAPPY_PATH_STEP_LABELS.length);
    }
  });
});

describe('nextHappyStatus', () => {
  it('advances DRAFT all the way to DEAL one status at a time', () => {
    const path: FixationStatus[] = ['DRAFT'];
    let current = nextHappyStatus('DRAFT');
    while (current) {
      path.push(current);
      current = nextHappyStatus(current);
    }
    expect(path).toEqual([
      'DRAFT',
      'SENT',
      'DUPLICATE_CHECK',
      'CONFIRMED',
      'BOOKING_REQUESTED',
      'BOOKED',
      'DEAL',
    ]);
  });

  it('has no successor for DEAL or for any rejection', () => {
    for (const status of ['DEAL', 'REJECTED_DUPLICATE', 'REJECTED_OTHER', 'EXPIRED', 'CANCELLED'] as const) {
      expect(nextHappyStatus(status)).toBeNull();
    }
  });
});

describe('isTerminal', () => {
  it('agrees with nextHappyStatus for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(isTerminal(status)).toBe(nextHappyStatus(status) === null);
    }
  });
});

describe('nextActionLabel', () => {
  it('offers an action only where the broker can actually move the fixation', () => {
    expect(nextActionLabel('DUPLICATE_CHECK')).toBe('Подтвердить');
    expect(nextActionLabel('CONFIRMED')).toBe('В бронь');
    expect(nextActionLabel('BOOKED')).toBe('Оформить сделку');
  });

  it('offers nothing on terminal statuses', () => {
    expect(nextActionLabel('DEAL')).toBeNull();
    expect(nextActionLabel('EXPIRED')).toBeNull();
  });
});

describe('statusLabel', () => {
  it('has a non-empty Russian label for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(statusLabel(status)).toBeTruthy();
      expect(statusLabel(status)).not.toBe(status);
    }
  });

  it('hides the internal duplicate-check step behind the same label as SENT', () => {
    expect(statusLabel('DUPLICATE_CHECK')).toBe(statusLabel('SENT'));
  });
});
