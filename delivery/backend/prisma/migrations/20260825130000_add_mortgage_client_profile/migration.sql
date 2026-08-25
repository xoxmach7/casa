-- M05 Client Profile: aggregate + sub-resources + immutable snapshot. Additive.

-- CreateEnum
CREATE TYPE "MortgageProfileFieldStatus" AS ENUM ('DECLARED', 'VERIFIED', 'UNKNOWN', 'CONFLICT');

-- CreateTable
CREATE TABLE "mortgage_client_profiles" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "latest_snapshot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mortgage_client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_employments" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "party_id" TEXT,
    "employer_name" TEXT NOT NULL,
    "employment_kind" TEXT NOT NULL,
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_income_sources" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "party_id" TEXT,
    "kind" TEXT NOT NULL,
    "monthly_amount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_assets" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "party_id" TEXT,
    "kind" TEXT NOT NULL,
    "value" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_down_payment_sources" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "party_id" TEXT,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_down_payment_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_non_credit_commitments" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "party_id" TEXT,
    "kind" TEXT NOT NULL,
    "monthly_amount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'DECLARED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_non_credit_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_client_profile_snapshots" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload_json" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mortgage_client_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mortgage_client_profiles_case_id_key" ON "mortgage_client_profiles"("case_id");
CREATE INDEX "mortgage_employments_profile_id_idx" ON "mortgage_employments"("profile_id");
CREATE INDEX "mortgage_income_sources_profile_id_idx" ON "mortgage_income_sources"("profile_id");
CREATE INDEX "mortgage_assets_profile_id_idx" ON "mortgage_assets"("profile_id");
CREATE INDEX "mortgage_down_payment_sources_profile_id_idx" ON "mortgage_down_payment_sources"("profile_id");
CREATE INDEX "mortgage_non_credit_commitments_profile_id_idx" ON "mortgage_non_credit_commitments"("profile_id");
CREATE INDEX "mortgage_client_profile_snapshots_case_id_created_at_idx" ON "mortgage_client_profile_snapshots"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "mortgage_client_profiles" ADD CONSTRAINT "mortgage_client_profiles_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_employments" ADD CONSTRAINT "mortgage_employments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_income_sources" ADD CONSTRAINT "mortgage_income_sources_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_assets" ADD CONSTRAINT "mortgage_assets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_down_payment_sources" ADD CONSTRAINT "mortgage_down_payment_sources_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_non_credit_commitments" ADD CONSTRAINT "mortgage_non_credit_commitments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mortgage_client_profile_snapshots" ADD CONSTRAINT "mortgage_client_profile_snapshots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
