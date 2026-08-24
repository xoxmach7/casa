import crypto from 'crypto';
import { isActiveMortgageConsent } from './mortgage-case.service';

export interface SnapshotConsentInput {
  status: string;
  purposeCode: string;
  allowedOperations: string[];
  grantedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface SnapshotPartyInput {
  clientId: string;
  role: string;
  consentRevision: SnapshotConsentInput | null;
}

export interface SnapshotFieldInput {
  id: string;
  fieldKey: string;
  isCritical: boolean;
  presence: string;
  reviewStatus: string;
}

export interface SnapshotDocumentInput {
  id: string;
  clientId: string;
  type: 'CREDIT_HISTORY' | 'ENPF_STATEMENT' | 'IDENTITY' | 'OTHER';
  status: string;
  revision: {
    id: string;
    status: string;
    sha256: string;
    fields: SnapshotFieldInput[];
  };
}

export interface SnapshotReadinessInput {
  clientId: string;
  parties: SnapshotPartyInput[];
  documents: SnapshotDocumentInput[];
}

export interface SnapshotReadiness {
  ready: boolean;
  reasonCodes: string[];
}

const REASON_ORDER = [
  'CONSENT_REQUIRED',
  'DOCUMENT_OWNER_MISMATCH',
  'DOCUMENT_TYPE_REQUIRED',
  'DOCUMENT_PROCESSING_FAILED',
  'DATA_CONFIRMATION_REQUIRED',
] as const;

function orderedReasons(reasons: Set<string>): string[] {
  return [...reasons].sort((left, right) => {
    const leftIndex = REASON_ORDER.indexOf(left as (typeof REASON_ORDER)[number]);
    const rightIndex = REASON_ORDER.indexOf(right as (typeof REASON_ORDER)[number]);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight || left.localeCompare(right);
  });
}

export function evaluateSnapshotReadiness(
  input: SnapshotReadinessInput,
  now = new Date(),
): SnapshotReadiness {
  const reasons = new Set<string>();

  if (
    input.parties.length === 0
    || input.parties.some(
      (party) => !party.consentRevision
        || !isActiveMortgageConsent(
          party.consentRevision,
          'calculate_preliminary_mortgage_options',
          now,
        ),
    )
  ) {
    reasons.add('CONSENT_REQUIRED');
  }

  if (input.documents.some((document) => document.clientId !== input.clientId)) {
    reasons.add('DOCUMENT_OWNER_MISMATCH');
  }

  const ownedDocuments = input.documents.filter((document) => document.clientId === input.clientId);
  for (const requiredType of ['CREDIT_HISTORY', 'ENPF_STATEMENT'] as const) {
    if (!ownedDocuments.some((document) => document.type === requiredType)) {
      reasons.add('DOCUMENT_TYPE_REQUIRED');
    }
  }

  for (const document of ownedDocuments) {
    if (document.status !== 'CONFIRMED' || document.revision.status !== 'CONFIRMED') {
      reasons.add('DOCUMENT_PROCESSING_FAILED');
    }
    if (
      document.revision.fields.some(
        (field) => field.isCritical
          && (
            !['PRESENT', 'EXPLICIT_ZERO'].includes(field.presence)
            || field.reviewStatus !== 'CONFIRMED'
          ),
      )
    ) {
      reasons.add('DATA_CONFIRMATION_REQUIRED');
    }
  }

  const reasonCodes = orderedReasons(reasons);
  return { ready: reasonCodes.length === 0, reasonCodes };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export interface BuildVerifiedSnapshotInput extends SnapshotReadinessInput {
  caseId: string;
  partyId: string;
  version: number;
  confirmedById: string;
  normalizedData: Record<string, unknown>;
}

export function buildVerifiedSnapshot(input: BuildVerifiedSnapshotInput) {
  const readiness = evaluateSnapshotReadiness(input);
  if (!readiness.ready) {
    const error = new Error('Snapshot prerequisites are not satisfied');
    Object.assign(error, { code: 'SNAPSHOT_NOT_READY', reasonCodes: readiness.reasonCodes });
    throw error;
  }

  const sourceDocumentRevisionIds = input.documents
    .map((document) => document.revision.id)
    .sort();
  const sourceReviewIds = input.documents
    .flatMap((document) => document.revision.fields.map((field) => field.id))
    .sort();
  const normalizedData = canonicalize(input.normalizedData);
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(canonicalize({
    caseId: input.caseId,
    clientId: input.clientId,
    partyId: input.partyId,
    version: input.version,
    sourceDocumentRevisionIds,
    sourceReviewIds,
    normalizedData,
  }))).digest('hex');

  return {
    caseId: input.caseId,
    clientId: input.clientId,
    partyId: input.partyId,
    version: input.version,
    sourceDocumentRevisionIds,
    sourceReviewIds,
    normalizedData,
    contentHash,
    confirmedById: input.confirmedById,
  };
}