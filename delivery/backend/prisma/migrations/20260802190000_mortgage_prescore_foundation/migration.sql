-- CreateEnum
CREATE TYPE "ConsentRevisionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "MortgageRuleType" AS ENUM ('REGULATORY_METRIC', 'PROGRAM_AFFORDABILITY', 'CASA_SAFETY_POLICY');

-- CreateEnum
CREATE TYPE "MortgageRuleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReasonCodeSeverity" AS ENUM ('BLOCKING', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "client_consents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_revisions" (
    "id" TEXT NOT NULL,
    "consent_id" TEXT NOT NULL,
    "purpose_code" TEXT NOT NULL,
    "purpose_description" TEXT NOT NULL,
    "allowed_operations" TEXT[],
    "data_categories" TEXT[],
    "source_channel" TEXT,
    "legal_text_version" TEXT NOT NULL,
    "legal_text_hash" TEXT,
    "evidence_type" TEXT,
    "evidence_ref" TEXT,
    "status" "ConsentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "granted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "supersedes_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_rule_versions" (
    "id" TEXT NOT NULL,
    "rule_type" "MortgageRuleType" NOT NULL,
    "bank_name" TEXT,
    "program_name" TEXT,
    "version_number" INTEGER NOT NULL,
    "status" "MortgageRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "source_url" TEXT,
    "source_hash" TEXT,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "author_id" TEXT,
    "approver_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortgage_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "code" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "severity" "ReasonCodeSeverity" NOT NULL,
    "message_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "next_step" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reason_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "client_consents_client_id_idx" ON "client_consents"("client_id");

-- CreateIndex
CREATE INDEX "consent_revisions_consent_id_idx" ON "consent_revisions"("consent_id");

-- CreateIndex
CREATE INDEX "consent_revisions_purpose_code_status_idx" ON "consent_revisions"("purpose_code", "status");

-- CreateIndex
CREATE INDEX "mortgage_rule_versions_rule_type_status_idx" ON "mortgage_rule_versions"("rule_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mortgage_rule_versions_bank_name_program_name_rule_type_ver_key" ON "mortgage_rule_versions"("bank_name", "program_name", "rule_type", "version_number");

-- AddForeignKey
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_revisions" ADD CONSTRAINT "consent_revisions_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "client_consents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgage_rule_versions" ADD CONSTRAINT "mortgage_rule_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgage_rule_versions" ADD CONSTRAINT "mortgage_rule_versions_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

