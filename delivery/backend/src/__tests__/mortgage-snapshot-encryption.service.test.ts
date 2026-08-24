import { describe, expect, it } from 'vitest';
import {
  MortgageSnapshotEncryption,
  type MortgageSnapshotKeyProvider,
} from '../lib/mortgage-snapshot-encryption.service';

const context = {
  caseId: 'case_1',
  clientId: 'client_1',
  snapshotVersion: 1,
  payloadSchemaVersion: 'prescore-v1',
  contentHash: 'a'.repeat(64),
};

const key = Buffer.alloc(32, 7);
const provider: MortgageSnapshotKeyProvider = {
  async getKey(keyRef) {
    if (keyRef !== 'test-key-v1') throw new Error('missing key');
    return key;
  },
};

describe('mortgage snapshot AES-256-GCM adapter', () => {
  it('encrypts and decrypts a snapshot payload through an injected key provider', async () => {
    const adapter = new MortgageSnapshotEncryption(provider);
    const payload = Buffer.from(JSON.stringify({ income: '500000', iin: 'redacted' }));

    const envelope = await adapter.encrypt(payload, 'test-key-v1', context);
    expect(envelope.algorithm).toBe('AES_256_GCM');
    expect(envelope.iv).toHaveLength(12);
    expect(envelope.authTag).toHaveLength(16);
    expect(envelope.ciphertext.equals(payload)).toBe(false);
    await expect(adapter.decrypt(envelope, context)).resolves.toEqual(payload);
  });

  it('binds ciphertext to case, client, version, schema and content hash', async () => {
    const adapter = new MortgageSnapshotEncryption(provider);
    const envelope = await adapter.encrypt(Buffer.from('bound'), 'test-key-v1', context);

    await expect(adapter.decrypt(envelope, { ...context, caseId: 'case_2' })).rejects.toThrow();
  });

  it('rejects ciphertext tampering', async () => {
    const adapter = new MortgageSnapshotEncryption(provider);
    const envelope = await adapter.encrypt(Buffer.from('sensitive'), 'test-key-v1', context);
    envelope.ciphertext[0] ^= 1;

    await expect(adapter.decrypt(envelope, context)).rejects.toThrow();
  });

  it('rejects a non-256-bit provider key', async () => {
    const adapter = new MortgageSnapshotEncryption({
      async getKey() {
        return Buffer.alloc(16);
      },
    });

    await expect(adapter.encrypt(Buffer.from('x'), 'bad-key', context)).rejects.toThrow(
      'Snapshot encryption key must be exactly 32 bytes',
    );
  });
});