import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const prismaDir = path.join(process.cwd(), 'prisma');
const schema = fs.readFileSync(path.join(prismaDir, 'schema.prisma'), 'utf8');
const migrationPath = path.join(
  prismaDir,
  'migrations',
  '20260824100000_add_mortgage_document_snapshot_workflow',
  'migration.sql',
);

describe('mortgage document and snapshot persistence contract', () => {
  it('defines documents, immutable revisions, reviews and verified snapshots', () => {
    for (const model of [
      'MortgageDocument',
      'MortgageDocumentRevision',
      'MortgageFieldReview',
      'MortgageVerifiedSnapshot',
      'MortgageSnapshotDocumentSource',
      'MortgageSnapshotReviewSource',
    ]) {
      expect(schema).toContain('model ' + model + ' {');
    }
    const reviewModel = schema.match(/model MortgageFieldReview \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(reviewModel).toContain('isCritical');
    expect(reviewModel).not.toContain('normalizedValue    Json');
    expect(reviewModel).toContain('valueHash');
    expect(reviewModel).not.toContain('sourceBbox         Json');
    expect(reviewModel).toContain('sourceBboxX');
    expect(schema).toContain('@@unique([documentId, version])');
    expect(schema).toContain('@@unique([caseId, version])');
    expect(schema).not.toMatch(/\bfileBytes\b|\brawPdf\b|\brawDocument\b/i);
    const snapshotModel = schema.match(/model MortgageVerifiedSnapshot \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(snapshotModel).not.toContain('normalizedData');
    expect(snapshotModel).toContain('encryptedPayload');
    expect(snapshotModel).toContain('encryptionKeyRef');
    expect(snapshotModel).toContain('encryptionAlgorithm');
    expect(snapshotModel).toContain('encryptionIv');
    expect(snapshotModel).toContain('encryptionAuthTag');
  });

  it('models scan/review/presence states without treating unknown as zero', () => {
    for (const value of [
      'SCAN_PENDING',
      'SCAN_CLEAN',
      'SCAN_REJECTED',
      'MANUAL_REVIEW_REQUIRED',
      'CONFIRMED',
      'EXPLICIT_ZERO',
      'UNREADABLE',
      'UNKNOWN',
    ]) {
      expect(schema).toContain(value);
    }
  });

  it('ships forward-only SQL with append-only revision and snapshot guards', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    for (const table of [
      'mortgage_documents',
      'mortgage_document_revisions',
      'mortgage_field_reviews',
      'mortgage_verified_snapshots',
      'mortgage_snapshot_document_sources',
      'mortgage_snapshot_review_sources',
    ]) {
      expect(sql).toContain('CREATE TABLE "' + table + '"');
    }

    expect(sql).toContain('prevent_mortgage_document_revision_mutation');
    expect(sql).toContain('prevent_mortgage_snapshot_mutation');
    expect(sql).toContain('prevent_mortgage_field_review_mutation');
    expect(sql).toContain('validate_mortgage_snapshot_document_source');
    expect(sql).toContain('validate_mortgage_snapshot_review_source');
    expect(sql).toContain('prevent_mortgage_snapshot_source_mutation');
    expect(sql).toContain('validate_mortgage_field_review_supersession');
    expect(sql).toContain('mortgage_document_revisions_final_status_check');
    expect(sql).toContain('mortgage_field_reviews_value_type_check');
    expect(sql).toContain('mortgage_verified_snapshots_encryption_key_ref_encryption_iv_key');
    expect(sql).toContain('mortgage_field_reviews_hash_only_check');
    expect(sql).toContain('mortgage_field_reviews_bbox_check');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "mortgage_document_revisions"');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "mortgage_verified_snapshots"');
    expect(sql).toContain('mortgage_document_revisions_sha256_check');
    expect(sql).not.toContain('source_document_revision_ids');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
});