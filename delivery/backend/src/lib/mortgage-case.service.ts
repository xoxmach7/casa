import crypto from 'crypto';
import { isPurposeApproved } from './mortgage-m01/purpose-registry';
import type { MortgageCaseStatus } from '@prisma/client';

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

export function mortgageRequestHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

export function canAccessMortgageCase(
  mortgageCase: { ownerId: string },
  actor: { userId: string; role: string },
): boolean {
  return actor.role === 'ADMIN' || mortgageCase.ownerId === actor.userId;
}

const ALLOWED_TRANSITIONS: Record<MortgageCaseStatus, readonly MortgageCaseStatus[]> = {
  DRAFT: ['CONSENT_PENDING', 'CANCELLED'],
  CONSENT_PENDING: ['DOCUMENTS_PENDING', 'CONSENT_REVOKED', 'CANCELLED'],
  DOCUMENTS_PENDING: ['PROCESSING', 'CONSENT_REVOKED', 'CANCELLED'],
  PROCESSING: ['REVIEW_REQUIRED', 'READY_TO_CALCULATE', 'CONSENT_REVOKED', 'CANCELLED'],
  REVIEW_REQUIRED: ['PROCESSING', 'READY_TO_CALCULATE', 'CONSENT_REVOKED', 'CANCELLED'],
  READY_TO_CALCULATE: ['ACTIVE', 'REVIEW_REQUIRED', 'CONSENT_REVOKED', 'CANCELLED'],
  ACTIVE: ['REVIEW_REQUIRED', 'CONSENT_REVOKED', 'ARCHIVED', 'CANCELLED'],
  CONSENT_REVOKED: ['CONSENT_PENDING', 'ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionMortgageCase(
  from: MortgageCaseStatus,
  to: MortgageCaseStatus,
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function isActiveMortgageConsent(
  revision: {
    status: string;
    purposeCode: string;
    allowedOperations: string[];
    grantedAt: Date | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
  },
  operation: string,
  now = new Date(),
): boolean {
  // M01 §8: цель берётся из реестра, а не хардкодится. Раньше здесь стояло
  // `purposeCode === 'mortgage_prescore'`, из-за чего согласие на утверждённую
  // цель M02 не открывало действий M01 — сквозной путь был непроходим.
  // Неизвестная или отключённая цель → deny.
  return revision.status === 'ACTIVE'
    && isPurposeApproved(revision.purposeCode)
    && revision.allowedOperations.includes(operation)
    && revision.grantedAt !== null
    && revision.grantedAt <= now
    && revision.revokedAt === null
    && (revision.expiresAt === null || revision.expiresAt > now);
}