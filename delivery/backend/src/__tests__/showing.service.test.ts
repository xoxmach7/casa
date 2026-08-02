import { describe, it, expect } from 'vitest';
import {
  canTransitionShow,
  isTerminalShowStatus,
  hasSchedulingConflict,
  canConfirmSlot,
  toCanonicalShowStatus,
  ALLOWED_SHOW_TRANSITIONS,
} from '../lib/showing.service';

describe('toCanonicalShowStatus', () => {
  it('maps legacy SCHEDULED to canonical CONFIRMED', () => {
    expect(toCanonicalShowStatus('SCHEDULED')).toBe('CONFIRMED');
  });

  it('passes through values already in the canonical set unchanged', () => {
    expect(toCanonicalShowStatus('COMPLETED')).toBe('COMPLETED');
    expect(toCanonicalShowStatus('CANCELLED')).toBe('CANCELLED');
    expect(toCanonicalShowStatus('DRAFT')).toBe('DRAFT');
  });
});

describe('canTransitionShow', () => {
  it('allows the full happy path through to completed', () => {
    expect(canTransitionShow('DRAFT', 'REQUESTED')).toBe(true);
    expect(canTransitionShow('REQUESTED', 'AWAITING_SELLER_CONFIRMATION')).toBe(true);
    expect(canTransitionShow('AWAITING_SELLER_CONFIRMATION', 'CONFIRMED')).toBe(true);
    expect(canTransitionShow('CONFIRMED', 'COMPLETED')).toBe(true);
  });

  it('allows reschedule loop back to awaiting confirmation or straight to confirmed', () => {
    expect(canTransitionShow('CONFIRMED', 'RESCHEDULE_REQUESTED')).toBe(true);
    expect(canTransitionShow('RESCHEDULE_REQUESTED', 'AWAITING_SELLER_CONFIRMATION')).toBe(true);
    expect(canTransitionShow('RESCHEDULE_REQUESTED', 'CONFIRMED')).toBe(true);
  });

  it('rejects skipping straight from draft to confirmed', () => {
    expect(canTransitionShow('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('rejects moving out of a terminal state', () => {
    expect(canTransitionShow('COMPLETED', 'CONFIRMED')).toBe(false);
    expect(canTransitionShow('CANCELLED', 'REQUESTED')).toBe(false);
  });

  it('every status has an entry in the transition table', () => {
    const statuses = Object.keys(ALLOWED_SHOW_TRANSITIONS);
    expect(statuses).toContain('NO_SHOW_BUYER');
    expect(statuses).toContain('NO_SHOW_SELLER');
    expect(statuses).toContain('EXPIRED');
  });
});

describe('isTerminalShowStatus', () => {
  it('marks completed/cancelled/no-show/expired as terminal', () => {
    expect(isTerminalShowStatus('COMPLETED')).toBe(true);
    expect(isTerminalShowStatus('CANCELLED')).toBe(true);
    expect(isTerminalShowStatus('NO_SHOW_BUYER')).toBe(true);
    expect(isTerminalShowStatus('NO_SHOW_SELLER')).toBe(true);
    expect(isTerminalShowStatus('EXPIRED')).toBe(true);
  });

  it('marks in-flight statuses as non-terminal', () => {
    expect(isTerminalShowStatus('DRAFT')).toBe(false);
    expect(isTerminalShowStatus('CONFIRMED')).toBe(false);
  });
});

describe('hasSchedulingConflict', () => {
  const existing = [
    { confirmedStartAt: new Date('2026-08-10T10:00:00Z'), confirmedEndAt: new Date('2026-08-10T11:00:00Z') },
  ];

  it('detects direct overlap', () => {
    expect(
      hasSchedulingConflict(existing, new Date('2026-08-10T10:30:00Z'), new Date('2026-08-10T11:30:00Z'))
    ).toBe(true);
  });

  it('detects a conflict inside the default 30-minute buffer', () => {
    expect(
      hasSchedulingConflict(existing, new Date('2026-08-10T11:15:00Z'), new Date('2026-08-10T12:00:00Z'))
    ).toBe(true);
  });

  it('allows a slot safely outside the buffer', () => {
    expect(
      hasSchedulingConflict(existing, new Date('2026-08-10T11:45:00Z'), new Date('2026-08-10T12:30:00Z'))
    ).toBe(false);
  });

  it('respects a custom buffer', () => {
    expect(
      hasSchedulingConflict(existing, new Date('2026-08-10T11:45:00Z'), new Date('2026-08-10T12:30:00Z'), 60)
    ).toBe(true);
  });
});

describe('canConfirmSlot', () => {
  it('allows confirming before or at the proposed slot end', () => {
    const end = new Date('2026-08-10T11:00:00Z');
    expect(canConfirmSlot(end, new Date('2026-08-10T10:00:00Z'))).toBe(true);
    expect(canConfirmSlot(end, end)).toBe(true);
  });

  it('rejects confirming after the proposed slot has expired', () => {
    const end = new Date('2026-08-10T11:00:00Z');
    expect(canConfirmSlot(end, new Date('2026-08-10T11:00:01Z'))).toBe(false);
  });
});
