import { describe, it, expect } from 'vitest';
import {
  canTransitionDealRoom,
  isTerminalDealRoomStage,
  canSetGreen2,
  canDraftDeposit,
  canActivateBooking,
  canProceedToNotary,
} from '../lib/deal-room.service';

describe('canTransitionDealRoom', () => {
  it('allows the full canonical happy path to sold', () => {
    expect(canTransitionDealRoom('OFFER_SUBMITTED', 'SELLER_REVIEW')).toBe(true);
    expect(canTransitionDealRoom('SELLER_REVIEW', 'PRICE_AGREED')).toBe(true);
    expect(canTransitionDealRoom('PRICE_AGREED', 'PRECHECK_IN_PROGRESS')).toBe(true);
    expect(canTransitionDealRoom('PRECHECK_IN_PROGRESS', 'GREEN_1')).toBe(true);
    expect(canTransitionDealRoom('GREEN_1', 'GREEN_2')).toBe(true);
    expect(canTransitionDealRoom('GREEN_2', 'DEPOSIT_AGREEMENT_DRAFTING')).toBe(true);
    expect(canTransitionDealRoom('DEPOSIT_AGREEMENT_DRAFTING', 'DEPOSIT_AGREEMENT_SENT')).toBe(true);
    expect(canTransitionDealRoom('DEPOSIT_AGREEMENT_SENT', 'DEPOSIT_AGREEMENT_SIGNED')).toBe(true);
    expect(canTransitionDealRoom('DEPOSIT_AGREEMENT_SIGNED', 'DEPOSIT_TRANSFER_PENDING')).toBe(true);
    expect(canTransitionDealRoom('DEPOSIT_TRANSFER_PENDING', 'BOOKING_ACTIVE')).toBe(true);
    expect(canTransitionDealRoom('BOOKING_ACTIVE', 'PAYMENT_ROUTE_IN_PROGRESS')).toBe(true);
    expect(canTransitionDealRoom('PAYMENT_ROUTE_IN_PROGRESS', 'READY_FOR_NOTARY')).toBe(true);
    expect(canTransitionDealRoom('READY_FOR_NOTARY', 'NOTARY_SCHEDULED')).toBe(true);
    expect(canTransitionDealRoom('NOTARY_SCHEDULED', 'REGISTRATION_OR_DISBURSEMENT')).toBe(true);
    expect(canTransitionDealRoom('REGISTRATION_OR_DISBURSEMENT', 'SOLD')).toBe(true);
  });

  it('rejects skipping Green 1/Green 2 — the non-negotiable rule from the spec', () => {
    expect(canTransitionDealRoom('PRECHECK_IN_PROGRESS', 'DEPOSIT_AGREEMENT_DRAFTING')).toBe(false);
    expect(canTransitionDealRoom('PRICE_AGREED', 'BOOKING_ACTIVE')).toBe(false);
  });

  it('allows failing out from almost any in-flight stage', () => {
    expect(canTransitionDealRoom('PRECHECK_IN_PROGRESS', 'FAILED')).toBe(true);
    expect(canTransitionDealRoom('BOOKING_ACTIVE', 'FAILED')).toBe(true);
  });

  it('rejects transitions out of terminal stages', () => {
    expect(canTransitionDealRoom('SOLD', 'FAILED')).toBe(false);
    expect(canTransitionDealRoom('FAILED', 'OFFER_SUBMITTED')).toBe(false);
  });
});

describe('isTerminalDealRoomStage', () => {
  it('marks sold and failed as terminal', () => {
    expect(isTerminalDealRoomStage('SOLD')).toBe(true);
    expect(isTerminalDealRoomStage('FAILED')).toBe(true);
  });

  it('marks in-flight stages as non-terminal', () => {
    expect(isTerminalDealRoomStage('GREEN_1')).toBe(false);
  });
});

describe('canSetGreen2', () => {
  const cleanPrecheck = {
    hasBlockingRisk: false,
    paymentRouteConfirmed: true,
    missingAmount: 0,
    mortgagePartConfirmed: true,
  };

  it('allows Green 2 when everything is clean', () => {
    expect(canSetGreen2(cleanPrecheck)).toEqual({ allowed: true, blockers: [] });
  });

  it('blocks on an open blocking risk', () => {
    const result = canSetGreen2({ ...cleanPrecheck, hasBlockingRisk: true });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('open_blocking_risk');
  });

  it('blocks on unclear payment route', () => {
    const result = canSetGreen2({ ...cleanPrecheck, paymentRouteConfirmed: false });
    expect(result.blockers).toContain('payment_route_unclear');
  });

  it('blocks when missing_amount > 0', () => {
    const result = canSetGreen2({ ...cleanPrecheck, missingAmount: 500_000 });
    expect(result.blockers).toContain('missing_amount_gt_zero');
  });

  it('blocks on unconfirmed mortgage part', () => {
    const result = canSetGreen2({ ...cleanPrecheck, mortgagePartConfirmed: false });
    expect(result.blockers).toContain('mortgage_part_unconfirmed');
  });

  it('reports all applicable blockers at once', () => {
    const result = canSetGreen2({
      hasBlockingRisk: true,
      paymentRouteConfirmed: false,
      missingAmount: 100,
      mortgagePartConfirmed: false,
    });
    expect(result.blockers).toHaveLength(4);
  });
});

describe('canDraftDeposit', () => {
  it('blocks before Green 2', () => {
    expect(canDraftDeposit('GREEN_1').allowed).toBe(false);
    expect(canDraftDeposit('PRECHECK_IN_PROGRESS').allowed).toBe(false);
  });

  it('allows at or after Green 2', () => {
    expect(canDraftDeposit('GREEN_2').allowed).toBe(true);
    expect(canDraftDeposit('DEPOSIT_AGREEMENT_SIGNED').allowed).toBe(true);
  });
});

describe('canActivateBooking', () => {
  it('requires signed/transferred deposit, proof, and coordinator verification all together', () => {
    expect(
      canActivateBooking({ status: 'TRANSFER_PENDING', proofFileAssetId: 'file_1', coordinatorVerified: true })
    ).toEqual({ allowed: true, blockers: [] });
  });

  it('blocks when deposit is only signed but not yet transferred', () => {
    const result = canActivateBooking({ status: 'SIGNED', proofFileAssetId: 'file_1', coordinatorVerified: true });
    expect(result.blockers).toContain('deposit_not_signed_or_transferred');
  });

  it('blocks without transfer proof even if coordinator says verified', () => {
    const result = canActivateBooking({ status: 'TRANSFER_PENDING', proofFileAssetId: null, coordinatorVerified: true });
    expect(result.blockers).toContain('missing_transfer_proof');
  });

  it('blocks without coordinator verification even with proof present', () => {
    const result = canActivateBooking({ status: 'TRANSFER_PENDING', proofFileAssetId: 'file_1', coordinatorVerified: false });
    expect(result.blockers).toContain('coordinator_verification_required');
  });
});

describe('canProceedToNotary', () => {
  it('allows when checklist is complete and no open blocker', () => {
    expect(canProceedToNotary(true, false)).toEqual({ allowed: true, blockers: [] });
  });

  it('blocks on incomplete checklist', () => {
    expect(canProceedToNotary(false, false).blockers).toContain('final_checklist_incomplete');
  });

  it('blocks on an open blocker', () => {
    expect(canProceedToNotary(true, true).blockers).toContain('open_blocker');
  });
});
