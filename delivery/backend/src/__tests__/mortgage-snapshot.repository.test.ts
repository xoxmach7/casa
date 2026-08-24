import { describe, expect, it, vi } from 'vitest';
import { persistMortgageVerifiedSnapshot } from '../lib/mortgage-snapshot.repository';

const activeConsent = {
  status: 'ACTIVE', purposeCode: 'mortgage_prescore',
  allowedOperations: ['calculate_preliminary_mortgage_options'],
  grantedAt: new Date('2026-01-01T00:00:00.000Z'), expiresAt: new Date('2099-01-01T00:00:00.000Z'), revokedAt: null,
};

describe('mortgage snapshot encrypted persistence', () => {
  it('encrypts the canonical payload with record-bound context and persists only the envelope', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'snapshot_1' });
    const transaction = vi.fn(async (operation: (tx: any) => unknown) => operation({ mortgageVerifiedSnapshot: { create } }));
    const encrypt = vi.fn().mockResolvedValue({ algorithm: 'AES_256_GCM' as const, keyRef: 'kms://mortgage/key-1', iv: Buffer.alloc(12, 1), authTag: Buffer.alloc(16, 2), ciphertext: Buffer.from('encrypted') });
    const result = await persistMortgageVerifiedSnapshot(
      { $transaction: transaction }, { encrypt },
      {
        caseId: 'case_1', clientId: 'client_1', partyId: 'party_1', version: 3, confirmedById: 'broker_1',
        parties: [{ clientId: 'client_1', role: 'PRIMARY', consentRevision: activeConsent }],
        documents: [
          { id: 'credit', clientId: 'client_1', type: 'CREDIT_HISTORY', status: 'CONFIRMED', revision: { id: 'rev_credit', status: 'CONFIRMED', sha256: 'a'.repeat(64), fields: [{ id: 'review_credit', fieldKey: 'debt', isCritical: true, presence: 'PRESENT', reviewStatus: 'CONFIRMED' }] } },
          { id: 'enpf', clientId: 'client_1', type: 'ENPF_STATEMENT', status: 'CONFIRMED', revision: { id: 'rev_enpf', status: 'CONFIRMED', sha256: 'b'.repeat(64), fields: [{ id: 'review_enpf', fieldKey: 'income', isCritical: true, presence: 'PRESENT', reviewStatus: 'CONFIRMED' }] } },
        ],
        normalizedData: { income: '500000', debt: '0' },
      },
      { keyRef: 'kms://mortgage/key-1', payloadSchemaVersion: '1.0' },
    );
    expect(result).toEqual({ id: 'snapshot_1' });
    const [plaintext, keyRef, context] = encrypt.mock.calls[0];
    expect(JSON.parse((plaintext as Buffer).toString('utf8'))).toEqual({ debt: '0', income: '500000' });
    expect(keyRef).toBe('kms://mortgage/key-1');
    expect(context).toMatchObject({ caseId: 'case_1', clientId: 'client_1', snapshotVersion: 3, payloadSchemaVersion: '1.0' });
    const persisted = create.mock.calls[0][0].data;
    expect(persisted).not.toHaveProperty('normalizedData');
    expect(persisted.encryptedPayload).toEqual(Buffer.from('encrypted'));
    expect(persisted.partyId).toBe('party_1');
    expect(persisted.documentSources.create).toEqual([{ revisionId: 'rev_credit' }, { revisionId: 'rev_enpf' }]);
    expect(persisted.reviewSources.create).toEqual([{ reviewId: 'review_credit' }, { reviewId: 'review_enpf' }]);
  });
});