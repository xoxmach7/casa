-- CreateEnum
CREATE TYPE "MortgageDocumentType" AS ENUM ('CREDIT_HISTORY', 'ENPF_STATEMENT', 'IDENTITY', 'OTHER');
CREATE TYPE "MortgageDocumentStatus" AS ENUM ('UPLOAD_PENDING', 'UPLOADED', 'SCAN_PENDING', 'SCAN_CLEAN', 'SCAN_REJECTED', 'EXTRACTION_PENDING', 'MANUAL_REVIEW_REQUIRED', 'CONFIRMED', 'PROCESSING_FAILED');
CREATE TYPE "MortgageFieldPresence" AS ENUM ('PRESENT', 'EXPLICIT_ZERO', 'BLANK', 'NOT_APPLICABLE', 'UNREADABLE', 'UNKNOWN', 'NOT_IN_TEMPLATE');
CREATE TYPE "MortgageFieldReviewStatus" AS ENUM ('UNREVIEWED', 'AUTO_ACCEPTED', 'MANUAL_REVIEW_REQUIRED', 'CONFIRMED', 'REJECTED');
CREATE TYPE "MortgageFieldValueType" AS ENUM ('MONEY', 'DECIMAL', 'INTEGER', 'BOOLEAN', 'DATE', 'DATETIME', 'CODE', 'HASH_ONLY');
CREATE TYPE "MortgageEncryptionAlgorithm" AS ENUM ('AES_256_GCM');

-- CreateTable
CREATE TABLE "mortgage_documents" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "type" "MortgageDocumentType" NOT NULL,
    "status" "MortgageDocumentStatus" NOT NULL DEFAULT 'UPLOAD_PENDING',
    "current_revision_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mortgage_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mortgage_documents_validity_check" CHECK ("valid_until" IS NULL OR "issued_at" IS NULL OR "valid_until" > "issued_at")
);

CREATE TABLE "mortgage_document_revisions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "object_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "page_count" INTEGER,
    "status" "MortgageDocumentStatus" NOT NULL,
    "extractor_version" TEXT,
    "extraction_hash" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_document_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mortgage_document_revisions_version_check" CHECK ("version" > 0),
    CONSTRAINT "mortgage_document_revisions_final_status_check" CHECK ("status" IN ('SCAN_REJECTED', 'MANUAL_REVIEW_REQUIRED', 'CONFIRMED', 'PROCESSING_FAILED')),
    CONSTRAINT "mortgage_document_revisions_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "mortgage_document_revisions_extraction_hash_check" CHECK ("extraction_hash" IS NULL OR "extraction_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "mortgage_document_revisions_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 26214400),
    CONSTRAINT "mortgage_document_revisions_page_check" CHECK ("page_count" IS NULL OR "page_count" > 0)
);

CREATE TABLE "mortgage_field_reviews" (
    "id" TEXT NOT NULL,
    "document_revision_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "value_type" "MortgageFieldValueType",
    "normalized_decimal" DECIMAL(20,6),
    "normalized_code" VARCHAR(64),
    "normalized_date" TIMESTAMP(3),
    "normalized_boolean" BOOLEAN,
    "value_hash" TEXT,
    "presence" "MortgageFieldPresence" NOT NULL,
    "confidence" DECIMAL(5,4),
    "source_page" INTEGER,
    "source_bbox_x" DECIMAL(10,6),
    "source_bbox_y" DECIMAL(10,6),
    "source_bbox_width" DECIMAL(10,6),
    "source_bbox_height" DECIMAL(10,6),
    "evidence_hash" TEXT,
    "review_status" "MortgageFieldReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "supersedes_review_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_field_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mortgage_field_reviews_version_check" CHECK ("version" > 0),
    CONSTRAINT "mortgage_field_reviews_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
    CONSTRAINT "mortgage_field_reviews_page_check" CHECK ("source_page" IS NULL OR "source_page" > 0),
    CONSTRAINT "mortgage_field_reviews_value_hash_check" CHECK ("value_hash" IS NULL OR "value_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "mortgage_field_reviews_evidence_hash_check" CHECK ("evidence_hash" IS NULL OR "evidence_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "mortgage_field_reviews_review_check" CHECK (("review_status" IN ('CONFIRMED', 'REJECTED') AND "reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL) OR ("review_status" NOT IN ('CONFIRMED', 'REJECTED') AND "reviewed_at" IS NULL)),
    CONSTRAINT "mortgage_field_reviews_value_count_check" CHECK (num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") <= 1),
    CONSTRAINT "mortgage_field_reviews_presence_value_check" CHECK (("presence" = 'PRESENT' AND "value_type" IS NOT NULL AND (("value_type" = 'HASH_ONLY' AND "value_hash" IS NOT NULL AND num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") = 0) OR ("value_type" <> 'HASH_ONLY' AND num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") = 1))) OR ("presence" = 'EXPLICIT_ZERO' AND "value_type" IN ('MONEY', 'DECIMAL', 'INTEGER') AND "normalized_decimal" = 0) OR ("presence" NOT IN ('PRESENT', 'EXPLICIT_ZERO') AND "value_type" IS NULL AND num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") = 0)),
    CONSTRAINT "mortgage_field_reviews_value_type_check" CHECK (
      ("value_type" IN ('MONEY', 'DECIMAL', 'INTEGER') AND "normalized_decimal" IS NOT NULL)
      OR ("value_type" = 'BOOLEAN' AND "normalized_boolean" IS NOT NULL)
      OR ("value_type" IN ('DATE', 'DATETIME') AND "normalized_date" IS NOT NULL)
      OR ("value_type" = 'CODE' AND "normalized_code" IS NOT NULL)
      OR ("value_type" = 'HASH_ONLY' AND "value_hash" IS NOT NULL AND num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") = 0)
      OR "value_type" IS NULL
    ),
    CONSTRAINT "mortgage_field_reviews_integer_check" CHECK ("value_type" <> 'INTEGER' OR "normalized_decimal" = trunc("normalized_decimal")),
    CONSTRAINT "mortgage_field_reviews_explicit_zero_check" CHECK ("presence" <> 'EXPLICIT_ZERO' OR ("value_type" IN ('MONEY', 'DECIMAL', 'INTEGER') AND "normalized_decimal" = 0)),
    CONSTRAINT "mortgage_field_reviews_bbox_check" CHECK (
      num_nonnulls("source_bbox_x", "source_bbox_y", "source_bbox_width", "source_bbox_height") IN (0, 4)
      AND ("source_bbox_x" IS NULL OR ("source_bbox_x" >= 0 AND "source_bbox_y" >= 0 AND "source_bbox_width" > 0 AND "source_bbox_height" > 0))
    ),
    CONSTRAINT "mortgage_field_reviews_hash_only_check" CHECK (
      "value_type" <> 'HASH_ONLY'
      OR ("value_hash" IS NOT NULL AND "value_hash" ~ '^[0-9a-f]{64}$' AND num_nonnulls("normalized_decimal", "normalized_code", "normalized_date", "normalized_boolean") = 0)
    )
);

CREATE TABLE "mortgage_verified_snapshots" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload_schema_version" TEXT NOT NULL,
    "encrypted_payload" BYTEA NOT NULL,
    "encryption_key_ref" TEXT NOT NULL,
    "encryption_algorithm" "MortgageEncryptionAlgorithm" NOT NULL,
    "encryption_iv" BYTEA NOT NULL,
    "encryption_auth_tag" BYTEA NOT NULL,
    "content_hash" TEXT NOT NULL,
    "confirmed_by_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_verified_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mortgage_verified_snapshots_version_check" CHECK ("version" > 0),
    CONSTRAINT "mortgage_verified_snapshots_payload_check" CHECK (octet_length("encrypted_payload") > 0 AND length("encryption_key_ref") > 0 AND length("payload_schema_version") > 0 AND octet_length("encryption_iv") = 12 AND octet_length("encryption_auth_tag") = 16),
    CONSTRAINT "mortgage_verified_snapshots_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "mortgage_snapshot_document_sources" (
    "snapshot_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    CONSTRAINT "mortgage_snapshot_document_sources_pkey" PRIMARY KEY ("snapshot_id", "revision_id")
);

CREATE TABLE "mortgage_snapshot_review_sources" (
    "snapshot_id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    CONSTRAINT "mortgage_snapshot_review_sources_pkey" PRIMARY KEY ("snapshot_id", "review_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mortgage_documents_id_current_revision_id_key" ON "mortgage_documents"("id", "current_revision_id");
CREATE INDEX "mortgage_documents_case_id_status_idx" ON "mortgage_documents"("case_id", "status");
CREATE INDEX "mortgage_documents_client_id_type_idx" ON "mortgage_documents"("client_id", "type");
CREATE UNIQUE INDEX "mortgage_document_revisions_document_id_version_key" ON "mortgage_document_revisions"("document_id", "version");
CREATE UNIQUE INDEX "mortgage_document_revisions_document_id_id_key" ON "mortgage_document_revisions"("document_id", "id");
CREATE INDEX "mortgage_document_revisions_sha256_idx" ON "mortgage_document_revisions"("sha256");
CREATE UNIQUE INDEX "mortgage_field_reviews_document_revision_id_field_key_version_key" ON "mortgage_field_reviews"("document_revision_id", "field_key", "version");
CREATE INDEX "mortgage_field_reviews_document_revision_id_field_key_idx" ON "mortgage_field_reviews"("document_revision_id", "field_key");
CREATE INDEX "mortgage_field_reviews_review_status_idx" ON "mortgage_field_reviews"("review_status");
CREATE UNIQUE INDEX "mortgage_verified_snapshots_case_id_version_key" ON "mortgage_verified_snapshots"("case_id", "version");
CREATE UNIQUE INDEX "mortgage_verified_snapshots_encryption_key_ref_encryption_iv_key" ON "mortgage_verified_snapshots"("encryption_key_ref", "encryption_iv");
CREATE INDEX "mortgage_verified_snapshots_client_id_confirmed_at_idx" ON "mortgage_verified_snapshots"("client_id", "confirmed_at");
CREATE INDEX "mortgage_verified_snapshots_content_hash_idx" ON "mortgage_verified_snapshots"("content_hash");
CREATE INDEX "mortgage_snapshot_document_sources_revision_id_idx" ON "mortgage_snapshot_document_sources"("revision_id");
CREATE INDEX "mortgage_snapshot_review_sources_review_id_idx" ON "mortgage_snapshot_review_sources"("review_id");

-- AddForeignKey
ALTER TABLE "mortgage_documents" ADD CONSTRAINT "mortgage_documents_party_fkey" FOREIGN KEY ("party_id", "case_id", "client_id") REFERENCES "mortgage_case_parties"("id", "case_id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_documents" ADD CONSTRAINT "mortgage_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_document_revisions" ADD CONSTRAINT "mortgage_document_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "mortgage_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_document_revisions" ADD CONSTRAINT "mortgage_document_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_documents" ADD CONSTRAINT "mortgage_documents_current_revision_fkey" FOREIGN KEY ("id", "current_revision_id") REFERENCES "mortgage_document_revisions"("document_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_field_reviews" ADD CONSTRAINT "mortgage_field_reviews_document_revision_id_fkey" FOREIGN KEY ("document_revision_id") REFERENCES "mortgage_document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_field_reviews" ADD CONSTRAINT "mortgage_field_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_field_reviews" ADD CONSTRAINT "mortgage_field_reviews_supersedes_review_id_fkey" FOREIGN KEY ("supersedes_review_id") REFERENCES "mortgage_field_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_verified_snapshots" ADD CONSTRAINT "mortgage_verified_snapshots_party_fkey" FOREIGN KEY ("party_id", "case_id", "client_id") REFERENCES "mortgage_case_parties"("id", "case_id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_verified_snapshots" ADD CONSTRAINT "mortgage_verified_snapshots_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_snapshot_document_sources" ADD CONSTRAINT "mortgage_snapshot_document_sources_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "mortgage_verified_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_snapshot_document_sources" ADD CONSTRAINT "mortgage_snapshot_document_sources_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "mortgage_document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_snapshot_review_sources" ADD CONSTRAINT "mortgage_snapshot_review_sources_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "mortgage_verified_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_snapshot_review_sources" ADD CONSTRAINT "mortgage_snapshot_review_sources_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "mortgage_field_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only guards.
CREATE FUNCTION "prevent_mortgage_document_revision_mutation"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'mortgage_document_revisions is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_document_revisions_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_document_revisions"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_document_revision_mutation"();

CREATE FUNCTION "prevent_mortgage_field_review_mutation"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'mortgage_field_reviews is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_field_reviews_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_field_reviews"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_field_review_mutation"();

CREATE FUNCTION "prevent_mortgage_snapshot_mutation"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'mortgage_verified_snapshots is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_verified_snapshots_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_verified_snapshots"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_snapshot_mutation"();

-- Source links are part of the immutable snapshot artifact.
CREATE FUNCTION "prevent_mortgage_snapshot_source_mutation"() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'mortgage snapshot provenance is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_snapshot_document_sources_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_snapshot_document_sources"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_snapshot_source_mutation"();
CREATE TRIGGER "mortgage_snapshot_review_sources_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_snapshot_review_sources"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_snapshot_source_mutation"();

CREATE FUNCTION "validate_mortgage_field_review_supersession"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supersedes_review_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "mortgage_field_reviews" previous
    WHERE previous.id = NEW.supersedes_review_id
      AND previous.id <> NEW.id
      AND previous.document_revision_id = NEW.document_revision_id
      AND previous.field_key = NEW.field_key
      AND previous.version < NEW.version
  ) THEN
    RAISE EXCEPTION 'invalid mortgage field review supersession';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_field_review_supersession_guard"
BEFORE INSERT ON "mortgage_field_reviews"
FOR EACH ROW EXECUTE FUNCTION "validate_mortgage_field_review_supersession"();

-- Provenance ownership guards.
CREATE FUNCTION "validate_mortgage_snapshot_document_source"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "mortgage_verified_snapshots" s
    JOIN "mortgage_document_revisions" r ON r.id = NEW.revision_id
    JOIN "mortgage_documents" d ON d.id = r.document_id
    WHERE s.id = NEW.snapshot_id
      AND d.case_id = s.case_id AND d.client_id = s.client_id AND d.party_id = s.party_id
      AND r.status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'snapshot document source does not belong to snapshot party or is not confirmed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_snapshot_document_source_guard"
BEFORE INSERT ON "mortgage_snapshot_document_sources"
FOR EACH ROW EXECUTE FUNCTION "validate_mortgage_snapshot_document_source"();

CREATE FUNCTION "validate_mortgage_snapshot_review_source"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "mortgage_verified_snapshots" s
    JOIN "mortgage_field_reviews" f ON f.id = NEW.review_id
    JOIN "mortgage_document_revisions" r ON r.id = f.document_revision_id
    JOIN "mortgage_documents" d ON d.id = r.document_id
    WHERE s.id = NEW.snapshot_id
      AND d.case_id = s.case_id AND d.client_id = s.client_id AND d.party_id = s.party_id
      AND EXISTS (SELECT 1 FROM "mortgage_snapshot_document_sources" ds WHERE ds.snapshot_id = s.id AND ds.revision_id = f.document_revision_id)
      AND (NOT f.is_critical OR (f.review_status = 'CONFIRMED' AND f.presence IN ('PRESENT', 'EXPLICIT_ZERO')))
  ) THEN
    RAISE EXCEPTION 'snapshot review source is invalid or unresolved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mortgage_snapshot_review_source_guard"
BEFORE INSERT ON "mortgage_snapshot_review_sources"
FOR EACH ROW EXECUTE FUNCTION "validate_mortgage_snapshot_review_source"();

CREATE FUNCTION "validate_mortgage_snapshot_sources_required"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "mortgage_snapshot_document_sources" d WHERE d.snapshot_id = NEW.id)
     OR NOT EXISTS (SELECT 1 FROM "mortgage_snapshot_review_sources" r WHERE r.snapshot_id = NEW.id) THEN
    RAISE EXCEPTION 'snapshot requires document and review provenance';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "mortgage_snapshot_sources_required"
AFTER INSERT ON "mortgage_verified_snapshots"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_mortgage_snapshot_sources_required"();