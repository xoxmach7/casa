import type { MortgageSnapshotEncryptionContext, MortgageSnapshotEncryptionEnvelope } from './mortgage-snapshot-encryption.service';
import { buildVerifiedSnapshot, type BuildVerifiedSnapshotInput } from './mortgage-snapshot.service';

interface SnapshotEncryptionPort {
  encrypt(
    plaintext: Buffer,
    keyRef: string,
    context: MortgageSnapshotEncryptionContext,
  ): Promise<MortgageSnapshotEncryptionEnvelope>;
}

interface SnapshotCreatePort {
  mortgageVerifiedSnapshot: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

interface SnapshotDatabasePort {
  $transaction(operation: (tx: SnapshotCreatePort) => Promise<unknown>): Promise<unknown>;
}

export interface PersistMortgageSnapshotOptions {
  keyRef: string;
  payloadSchemaVersion: string;
}

export async function persistMortgageVerifiedSnapshot(
  database: SnapshotDatabasePort,
  encryption: SnapshotEncryptionPort,
  input: BuildVerifiedSnapshotInput,
  options: PersistMortgageSnapshotOptions,
): Promise<unknown> {
  if (!options.payloadSchemaVersion.trim()) {
    throw new Error('Snapshot payload schema version is required');
  }

  const snapshot = buildVerifiedSnapshot(input);
  const context: MortgageSnapshotEncryptionContext = {
    caseId: snapshot.caseId,
    clientId: snapshot.clientId,
    snapshotVersion: snapshot.version,
    payloadSchemaVersion: options.payloadSchemaVersion,
    contentHash: snapshot.contentHash,
  };
  const plaintext = Buffer.from(JSON.stringify(snapshot.normalizedData), 'utf8');
  const envelope = await encryption.encrypt(plaintext, options.keyRef, context);

  return database.$transaction((tx) => tx.mortgageVerifiedSnapshot.create({
    data: {
      caseId: snapshot.caseId,
      clientId: snapshot.clientId,
      partyId: snapshot.partyId,
      version: snapshot.version,
      payloadSchemaVersion: options.payloadSchemaVersion,
      encryptedPayload: envelope.ciphertext,
      encryptionKeyRef: envelope.keyRef,
      encryptionAlgorithm: envelope.algorithm,
      encryptionIv: envelope.iv,
      encryptionAuthTag: envelope.authTag,
      contentHash: snapshot.contentHash,
      confirmedById: snapshot.confirmedById,
      documentSources: {
        create: snapshot.sourceDocumentRevisionIds.map((revisionId) => ({ revisionId })),
      },
      reviewSources: {
        create: snapshot.sourceReviewIds.map((reviewId) => ({ reviewId })),
      },
    },
  }));
}