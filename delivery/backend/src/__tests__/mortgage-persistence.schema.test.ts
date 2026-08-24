import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const prismaDir = path.join(process.cwd(), 'prisma');
const schema = fs.readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8');
const migrationPath = path.join(
  prismaDir,
  'migrations',
  '20260824090000_add_mortgage_prescore_foundation',
  'migration.sql',
);

describe('mortgage PreScore persistence contract', () => {
  it('defines the five guarded foundation aggregates and inverse relations', () => {
    for (const model of [
      'MortgageCase',
      'MortgageCaseParty',
      'MortgageRecipientGrant',
      'MortgageIdempotencyRecord',
      'MortgageAuditEvent',
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }

    expect(schema).toContain('@@unique([caseId, clientId, role])');
    expect(schema).toContain('@@unique([actorId, operation, key])');
    expect(schema).toMatch(/version\s+Int\s+@default\(1\)/);
    expect(schema).toContain('mortgageCasesOwned');
    expect(schema).toContain('mortgageCaseParties');
    expect(schema).toContain('mortgageRecipientGrants');
  });

  it('ships a forward-only migration with matching tables and uniqueness', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    for (const table of [
      'mortgage_cases',
      'mortgage_case_parties',
      'mortgage_recipient_grants',
      'mortgage_idempotency_records',
      'mortgage_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    expect(sql).toContain('mortgage_case_parties_case_id_client_id_role_key');
    expect(sql).toContain('mortgage_idempotency_records_actor_id_operation_key_key');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  it('keeps audit storage hash-only and migration-enforced append-only', () => {
    const auditModel = schema.match(/model MortgageAuditEvent \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(auditModel).not.toContain('updatedAt');
    expect(auditModel).not.toContain('metadata   Json');
    expect(auditModel).toContain('metadataHash');
    expect(auditModel).not.toMatch(/\biin\b|fullName|documentText|token/i);

    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('prevent_mortgage_audit_mutation');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "mortgage_audit_events"');
  });

  it('pins enum values and recipient-grant validity constraints', () => {
    for (const value of [
      'CONSENT_PENDING',
      'READY_TO_CALCULATE',
      'CONSENT_REVOKED',
      'CO_BORROWER',
      'GUARANTOR',
      'DEVELOPER',
      'REVOKED',
    ]) {
      expect(schema).toContain(value);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('mortgage_recipient_grants_validity_check');
    expect(sql).toContain('mortgage_recipient_grants_revocation_check');
  });
});
