import crypto from 'crypto';

export interface MortgageSnapshotKeyProvider {
  getKey(keyRef: string): Promise<Buffer>;
}

export interface MortgageSnapshotEncryptionContext {
  caseId: string;
  clientId: string;
  snapshotVersion: number;
  payloadSchemaVersion: string;
  contentHash: string;
}

export interface MortgageSnapshotEncryptionEnvelope {
  algorithm: 'AES_256_GCM';
  keyRef: string;
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}

function associatedData(
  keyRef: string,
  context: MortgageSnapshotEncryptionContext,
): Buffer {
  return Buffer.from(JSON.stringify({
    artifact: 'mortgage_verified_snapshot',
    algorithm: 'AES_256_GCM',
    keyRef,
    caseId: context.caseId,
    clientId: context.clientId,
    snapshotVersion: context.snapshotVersion,
    payloadSchemaVersion: context.payloadSchemaVersion,
    contentHash: context.contentHash,
  }));
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) {
    throw new Error('Snapshot encryption key must be exactly 32 bytes');
  }
}

export class MortgageSnapshotEncryption {
  constructor(private readonly keyProvider: MortgageSnapshotKeyProvider) {}

  async encrypt(
    plaintext: Buffer,
    keyRef: string,
    context: MortgageSnapshotEncryptionContext,
  ): Promise<MortgageSnapshotEncryptionEnvelope> {
    if (!keyRef.trim()) throw new Error('Snapshot encryption key reference is required');
    const key = await this.keyProvider.getKey(keyRef);
    assertKey(key);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(associatedData(keyRef, context));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: 'AES_256_GCM',
      keyRef,
      iv,
      authTag,
      ciphertext,
    };
  }

  async decrypt(
    envelope: MortgageSnapshotEncryptionEnvelope,
    context: MortgageSnapshotEncryptionContext,
  ): Promise<Buffer> {
    if (envelope.algorithm !== 'AES_256_GCM') {
      throw new Error('Unsupported snapshot encryption algorithm');
    }
    if (envelope.iv.length !== 12 || envelope.authTag.length !== 16) {
      throw new Error('Invalid AES-GCM envelope');
    }

    const key = await this.keyProvider.getKey(envelope.keyRef);
    assertKey(key);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, envelope.iv);
    decipher.setAAD(associatedData(envelope.keyRef, context));
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
  }
}