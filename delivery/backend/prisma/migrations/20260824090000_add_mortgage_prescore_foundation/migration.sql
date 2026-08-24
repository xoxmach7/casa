-- CreateEnum
CREATE TYPE "MortgageCaseStatus" AS ENUM ('DRAFT', 'CONSENT_PENDING', 'DOCUMENTS_PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'READY_TO_CALCULATE', 'ACTIVE', 'CONSENT_REVOKED', 'CANCELLED', 'ARCHIVED');

CREATE TYPE "MortgagePartyRole" AS ENUM ('PRIMARY', 'CO_BORROWER', 'GUARANTOR');

CREATE TYPE "MortgageRecipientType" AS ENUM ('BANK', 'DEVELOPER', 'OTHER');

CREATE TYPE "MortgageRecipientGrantStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "mortgage_cases" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "status" "MortgageCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "latest_snapshot_id" TEXT,
    "latest_result_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mortgage_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mortgage_case_parties" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "role" "MortgagePartyRole" NOT NULL,
    "consent_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_case_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mortgage_recipient_grants" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "consent_revision_id" TEXT NOT NULL,
    "recipient_type" "MortgageRecipientType" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "recipient_legal_name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "data_categories" TEXT[],
    "allowed_operations" TEXT[],
    "status" "MortgageRecipientGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_recipient_grants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mortgage_recipient_grants_validity_check" CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at"),
    CONSTRAINT "mortgage_recipient_grants_revocation_check" CHECK (("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL)),
    CONSTRAINT "mortgage_recipient_grants_expiry_status_check" CHECK ("status" <> 'EXPIRED' OR "expires_at" IS NOT NULL)
);

CREATE TABLE "mortgage_idempotency_records" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "resource_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mortgage_audit_events" (
    "id" TEXT NOT NULL,
    "case_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "purpose" TEXT,
    "result" TEXT NOT NULL,
    "reason_code" TEXT,
    "metadata_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mortgage_cases_client_id_idx" ON "mortgage_cases"("client_id");
CREATE INDEX "mortgage_cases_owner_id_status_idx" ON "mortgage_cases"("owner_id", "status");
CREATE UNIQUE INDEX "mortgage_case_parties_case_id_client_id_role_key" ON "mortgage_case_parties"("case_id", "client_id", "role");
CREATE UNIQUE INDEX "mortgage_case_parties_id_case_id_client_id_key" ON "mortgage_case_parties"("id", "case_id", "client_id");
CREATE INDEX "mortgage_case_parties_client_id_idx" ON "mortgage_case_parties"("client_id");
CREATE INDEX "mortgage_case_parties_consent_revision_id_idx" ON "mortgage_case_parties"("consent_revision_id");
CREATE INDEX "mortgage_recipient_grants_case_id_status_idx" ON "mortgage_recipient_grants"("case_id", "status");
CREATE INDEX "mortgage_recipient_grants_consent_revision_id_idx" ON "mortgage_recipient_grants"("consent_revision_id");
CREATE INDEX "mortgage_recipient_grants_recipient_type_recipient_id_idx" ON "mortgage_recipient_grants"("recipient_type", "recipient_id");
CREATE UNIQUE INDEX "mortgage_idempotency_records_actor_id_operation_key_key" ON "mortgage_idempotency_records"("actor_id", "operation", "key");
CREATE INDEX "mortgage_idempotency_records_expires_at_idx" ON "mortgage_idempotency_records"("expires_at");
CREATE INDEX "mortgage_audit_events_case_id_created_at_idx" ON "mortgage_audit_events"("case_id", "created_at");
CREATE INDEX "mortgage_audit_events_actor_id_created_at_idx" ON "mortgage_audit_events"("actor_id", "created_at");
CREATE INDEX "mortgage_audit_events_object_type_object_id_idx" ON "mortgage_audit_events"("object_type", "object_id");

-- AddForeignKey
ALTER TABLE "mortgage_cases" ADD CONSTRAINT "mortgage_cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_cases" ADD CONSTRAINT "mortgage_cases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_case_parties" ADD CONSTRAINT "mortgage_case_parties_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_case_parties" ADD CONSTRAINT "mortgage_case_parties_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_case_parties" ADD CONSTRAINT "mortgage_case_parties_consent_revision_id_fkey" FOREIGN KEY ("consent_revision_id") REFERENCES "consent_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mortgage_recipient_grants" ADD CONSTRAINT "mortgage_recipient_grants_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_recipient_grants" ADD CONSTRAINT "mortgage_recipient_grants_consent_revision_id_fkey" FOREIGN KEY ("consent_revision_id") REFERENCES "consent_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_idempotency_records" ADD CONSTRAINT "mortgage_idempotency_records_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_audit_events" ADD CONSTRAINT "mortgage_audit_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mortgage_audit_events" ADD CONSTRAINT "mortgage_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Mortgage audit events form an append-only security trail. The trigger prevents
-- accidental or privileged application code from mutating or deleting history.
CREATE FUNCTION "prevent_mortgage_audit_mutation"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'mortgage_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mortgage_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "mortgage_audit_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_mortgage_audit_mutation"();