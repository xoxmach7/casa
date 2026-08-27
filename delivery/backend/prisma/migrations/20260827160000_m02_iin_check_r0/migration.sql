-- M02 R0 — IIN check: реестр источников (в коде, versioned), batch, per-source
-- result, immutable fact, ручные задачи.
--
-- Источник: M02_CASA_Pro_IIN_Check_R0_Implementation_and_Acceptance_v1.0.
-- Полный ИИН НЕ хранится: субъект адресуется borrower_ref, маской и HMAC-токеном
-- поиска (§7 «ПОЛНЫЙ ИИН», §16 IIN protection). Внешние коннекторы выключены
-- deny-by-default — таблицы описывают ручной и client-authorized маршруты R0.

-- CreateEnum
CREATE TYPE "ClientCheckStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'MANUAL_REQUIRED', 'BLOCKED', 'UNAVAILABLE', 'ERROR', 'NOT_ALLOWED');

-- CreateEnum
CREATE TYPE "ClientCheckOutcome" AS ENUM ('FOUND', 'NOT_FOUND', 'ZERO', 'NOT_APPLICABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ClientCheckOverallStatus" AS ENUM ('COMPLETE_FACTS_FOUND', 'COMPLETE_NO_RECORDS', 'PARTIAL', 'BLOCKED_CONSENT', 'BLOCKED_LEGAL', 'STALE');

-- CreateEnum
CREATE TYPE "ManualCheckTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "client_check_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_scope_kind" TEXT NOT NULL DEFAULT 'CASE_OWNER',
    "case_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "borrower_ref" TEXT NOT NULL,
    "iin_masked" TEXT NOT NULL,
    "iin_lookup_token" TEXT NOT NULL,
    "identity_version" INTEGER NOT NULL,
    "consent_revision_id" TEXT,
    "consent_purpose" TEXT NOT NULL,
    "manifest_version" TEXT NOT NULL,
    "registry_version" TEXT NOT NULL,
    "manifest_json" JSONB NOT NULL,
    "required_total" INTEGER NOT NULL,
    "actor_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overall_status" "ClientCheckOverallStatus" NOT NULL,
    "coverage_json" JSONB NOT NULL,
    "blocker_code" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "supersedes_id" TEXT,
    "superseded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_check_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_check_results" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "source_owner" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "automation_mode" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClientCheckStatus" NOT NULL,
    "outcome" "ClientCheckOutcome",
    "error_category" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "upstream_code" TEXT,
    "checked_at" TIMESTAMP(3),
    "source_data_as_of" TIMESTAMP(3),
    "fresh_until" TIMESTAMP(3),
    "legal_basis_status" TEXT,
    "consent_revision_id" TEXT,
    "approval_id" TEXT,
    "evidence_ref" TEXT,
    "evidence_hash" TEXT,
    "retention_policy_id" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" TEXT,
    "superseded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_check_facts" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fact_key" TEXT NOT NULL,
    "fact_value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_check_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_check_tasks" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "official_url" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "assignee_id" TEXT,
    "due_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" "ManualCheckTaskStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "ClientCheckOutcome",
    "evidence_ref" TEXT,
    "evidence_hash" TEXT,
    "checked_at" TIMESTAMP(3),
    "source_data_as_of" TIMESTAMP(3),
    "fresh_until" TIMESTAMP(3),
    "confirmed_by_actor_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_check_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_check_batches_case_id_created_at_idx" ON "client_check_batches"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "client_check_batches_tenant_id_idx" ON "client_check_batches"("tenant_id");

-- CreateIndex
CREATE INDEX "client_check_batches_iin_lookup_token_idx" ON "client_check_batches"("iin_lookup_token");

-- CreateIndex
CREATE INDEX "client_check_results_batch_id_idx" ON "client_check_results"("batch_id");

-- CreateIndex
CREATE INDEX "client_check_results_tenant_id_idx" ON "client_check_results"("tenant_id");

-- CreateIndex
CREATE INDEX "client_check_facts_result_id_idx" ON "client_check_facts"("result_id");

-- CreateIndex
CREATE INDEX "manual_check_tasks_batch_id_idx" ON "manual_check_tasks"("batch_id");

-- CreateIndex
CREATE INDEX "manual_check_tasks_tenant_id_status_idx" ON "manual_check_tasks"("tenant_id", "status");

-- RenameForeignKey
ALTER TABLE "mortgage_documents" RENAME CONSTRAINT "mortgage_documents_current_revision_fkey" TO "mortgage_documents_id_current_revision_id_fkey";

-- RenameForeignKey
ALTER TABLE "mortgage_documents" RENAME CONSTRAINT "mortgage_documents_party_fkey" TO "mortgage_documents_party_id_case_id_client_id_fkey";

-- RenameForeignKey
ALTER TABLE "mortgage_verified_snapshots" RENAME CONSTRAINT "mortgage_verified_snapshots_party_fkey" TO "mortgage_verified_snapshots_party_id_case_id_client_id_fkey";

-- AddForeignKey
ALTER TABLE "client_check_batches" ADD CONSTRAINT "client_check_batches_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_check_results" ADD CONSTRAINT "client_check_results_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "client_check_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_check_facts" ADD CONSTRAINT "client_check_facts_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "client_check_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_check_tasks" ADD CONSTRAINT "manual_check_tasks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "client_check_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_check_tasks" ADD CONSTRAINT "manual_check_tasks_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "client_check_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "mortgage_field_reviews_document_revision_id_field_key_version_k" RENAME TO "mortgage_field_reviews_document_revision_id_field_key_versi_key";

-- RenameIndex
ALTER INDEX "mortgage_verified_snapshots_encryption_key_ref_encryption_iv_ke" RENAME TO "mortgage_verified_snapshots_encryption_key_ref_encryption_i_key";

