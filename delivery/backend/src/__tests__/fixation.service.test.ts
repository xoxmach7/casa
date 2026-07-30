import { describe, it, expect } from 'vitest';
import { canTransition, isTerminal, ALLOWED_TRANSITIONS, FixationStatus } from '../lib/fixation.service';

describe('canTransition', () => {
  it('allows DRAFT -> SENT', () => {
    expect(canTransition('DRAFT', 'SENT')).toBe(true);
  });

  it('allows SENT -> DUPLICATE_CHECK', () => {
    expect(canTransition('SENT', 'DUPLICATE_CHECK')).toBe(true);
  });

  it('allows DUPLICATE_CHECK -> CONFIRMED/REJECTED_DUPLICATE/REJECTED_OTHER', () => {
    expect(canTransition('DUPLICATE_CHECK', 'CONFIRMED')).toBe(true);
    expect(canTransition('DUPLICATE_CHECK', 'REJECTED_DUPLICATE')).toBe(true);
    expect(canTransition('DUPLICATE_CHECK', 'REJECTED_OTHER')).toBe(true);
  });

  it('allows the full happy path through to DEAL', () => {
    expect(canTransition('CONFIRMED', 'BOOKING_REQUESTED')).toBe(true);
    expect(canTransition('BOOKING_REQUESTED', 'BOOKED')).toBe(true);
    expect(canTransition('BOOKED', 'DEAL')).toBe(true);
  });

  it('rejects skipping steps (DRAFT -> CONFIRMED)', () => {
    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('rejects moving out of a terminal state', () => {
    expect(canTransition('DEAL', 'SENT')).toBe(false);
    expect(canTransition('REJECTED_DUPLICATE', 'SENT')).toBe(false);
  });

  it('allows CANCELLED from every non-terminal state', () => {
    const nonTerminal: FixationStatus[] = ['DRAFT', 'SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'BOOKING_REQUESTED', 'BOOKED'];
    for (const status of nonTerminal) {
      expect(canTransition(status, 'CANCELLED')).toBe(true);
    }
  });
});

describe('isTerminal', () => {
  it('flags DEAL, rejections, expiry, and cancellation as terminal', () => {
    expect(isTerminal('DEAL')).toBe(true);
    expect(isTerminal('REJECTED_DUPLICATE')).toBe(true);
    expect(isTerminal('REJECTED_OTHER')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
  });

  it('does not flag in-progress states as terminal', () => {
    expect(isTerminal('DRAFT')).toBe(false);
    expect(isTerminal('SENT')).toBe(false);
    expect(isTerminal('CONFIRMED')).toBe(false);
  });
});

describe('ALLOWED_TRANSITIONS completeness', () => {
  it('has an entry for every FixationStatus value', () => {
    const allStatuses: FixationStatus[] = [
      'DRAFT', 'SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'REJECTED_DUPLICATE',
      'REJECTED_OTHER', 'EXPIRED', 'BOOKING_REQUESTED', 'BOOKED', 'DEAL', 'CANCELLED',
    ];
    for (const status of allStatuses) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });
});
