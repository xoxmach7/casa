import { describe, expect, it } from 'vitest';
import {
  buildVerifiedSnapshot,
  evaluateSnapshotReadiness,
  type SnapshotDocumentInput,
  type SnapshotPartyInput,
} from '../lib/mortgage-snapshot.service';

const activeConsent = {
  status: 'ACTIVE',
  purposeCode: 'mortgage_prescore',
  allowedOperations: ['calculate_preliminary_mortgage_options'],
  grantedAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  revokedAt: null,
};

const parties = (overrides: Partial<SnapshotPartyInput> = {}): SnapshotPartyInput[] => [{
  clientId: 'client_1',
  role: 'PRIMARY',
  consentRevision: activeConsent,
  ...overrides,
}];

const document = (
  type: 'CREDIT_HISTORY' | 'ENPF_STATEMENT',
  overrides: Partial<SnapshotDocumentInput> = {},
): SnapshotDocumentInput => ({
  id: 'doc_' + type,
  clientId: 'client_1',
  type,
  status: 'CONFIRMED',
  revision: {
    id: 'rev_' + type,
    status: 'CONFIRMED',
    sha256: type === 'CREDIT_HISTORY' ? 'a'.repeat(64) : 'b'.repeat(64),
    fields: [{
      id: 'field_' + type,
      fieldKey: 'critical',
      isCritical: true,
      presence: 'PRESENT',
      reviewStatus: 'CONFIRMED',
    }],
  },
  ...overrides,
});

describe('mortgage verified snapshot gate', () => {
  it('requires active calculation consent for every case party', () => {
    const result = evaluateSnapshotReadiness({
      clientId: 'client_1',
      parties: parties({
        consentRevision: { ...activeConsent, status: 'REVOKED', revokedAt: new Date() },
      }),
      documents: [document('CREDIT_HISTORY'), document('ENPF_STATEMENT')],
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain('CONSENT_REQUIRED');
  });

  it('requires both confirmed source documents and resolved critical fields', () => {
    const missingPension = evaluateSnapshotReadiness({
      clientId: 'client_1',
      parties: parties(),
      documents: [document('CREDIT_HISTORY')],
    });
    expect(missingPension.reasonCodes).toContain('DOCUMENT_TYPE_REQUIRED');

    const unresolved = evaluateSnapshotReadiness({
      clientId: 'client_1',
      parties: parties(),
      documents: [
        document('CREDIT_HISTORY', {
          revision: {
            ...document('CREDIT_HISTORY').revision,
            fields: [{
              id: 'field_credit',
              fieldKey: 'monthlyPayment',
              isCritical: true,
              presence: 'UNKNOWN',
              reviewStatus: 'MANUAL_REVIEW_REQUIRED',
            }],
          },
        }),
        document('ENPF_STATEMENT'),
      ],
    });
    expect(unresolved.reasonCodes).toContain('DATA_CONFIRMATION_REQUIRED');
  });

  it('rejects a document belonging to another client', () => {
    const result = evaluateSnapshotReadiness({
      clientId: 'client_1',
      parties: parties(),
      documents: [
        document('CREDIT_HISTORY', { clientId: 'client_2' }),
        document('ENPF_STATEMENT'),
      ],
    });

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain('DOCUMENT_OWNER_MISMATCH');
  });

  it('builds a deterministic immutable payload and source hash', () => {
    const input = {
      caseId: 'case_1',
      clientId: 'client_1',
      partyId: 'party_1',
      version: 1,
      confirmedById: 'broker_1',
      parties: parties(),
      documents: [document('ENPF_STATEMENT'), document('CREDIT_HISTORY')],
      normalizedData: {
        incomeStreams: [{ fingerprint: 'salary', amount: '500000', verified: true, eligible: true }],
        facilities: [],
        asOf: '2026-08-24T00:00:00.000Z',
      },
    };

    const first = buildVerifiedSnapshot(input);
    const second = buildVerifiedSnapshot({
      ...input,
      normalizedData: {
        asOf: '2026-08-24T00:00:00.000Z',
        facilities: [],
        incomeStreams: [{ eligible: true, verified: true, amount: '500000', fingerprint: 'salary' }],
      },
    });

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.sourceDocumentRevisionIds).toEqual([
      'rev_CREDIT_HISTORY',
      'rev_ENPF_STATEMENT',
    ]);
    expect(first.sourceReviewIds).toEqual([
      'field_CREDIT_HISTORY',
      'field_ENPF_STATEMENT',
    ]);
  });
});