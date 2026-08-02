-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('SUBMITTED', 'PRELIMINARY_CALCULATION', 'PRELIMINARY_READY', 'MANUAL_REVIEW_REQUIRED', 'COMPARABLE_COLLECTION', 'HUMAN_REVIEW', 'CONFIRMED', 'ACCEPTED', 'ACCEPTED_WITH_PRICE_CONDITION', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValuationLiquidity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ValuationConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ValuationDecision" AS ENUM ('ACCEPTED', 'ACCEPTED_WITH_PRICE_CONDITION', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComparableCompatibility" AS ENUM ('DIRECT', 'CLOSE', 'MARKET_CONTEXT');

-- CreateTable
CREATE TABLE "valuations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "status" "ValuationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuation_versions" (
    "id" TEXT NOT NULL,
    "valuation_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "preliminary_low" DECIMAL(15,2),
    "preliminary_high" DECIMAL(15,2),
    "confirmed_low" DECIMAL(15,2),
    "confirmed_high" DECIMAL(15,2),
    "urgent_low" DECIMAL(15,2),
    "urgent_high" DECIMAL(15,2),
    "recommended_launch_price" DECIMAL(15,2),
    "max_launch_price" DECIMAL(15,2),
    "liquidity" "ValuationLiquidity",
    "confidence" "ValuationConfidence",
    "decision" "ValuationDecision",
    "reviewer_reason" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "market_reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparables" (
    "id" TEXT NOT NULL,
    "valuation_version_id" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "asking_price" DECIMAL(15,2) NOT NULL,
    "total_area" DECIMAL(10,2) NOT NULL,
    "price_per_m2" DECIMAL(15,2),
    "compatibility" "ComparableCompatibility" NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "reason_excluded" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_references" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "district_id" TEXT,
    "residential_complex_id" TEXT,
    "rooms" INTEGER,
    "renovation_state" TEXT,
    "base_price_per_m2_low" DECIMAL(15,2) NOT NULL,
    "base_price_per_m2_high" DECIMAL(15,2) NOT NULL,
    "source_date" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "valuations_property_id_idx" ON "valuations"("property_id");

-- CreateIndex
CREATE INDEX "valuations_status_idx" ON "valuations"("status");

-- CreateIndex
CREATE INDEX "valuation_versions_valuation_id_idx" ON "valuation_versions"("valuation_id");

-- CreateIndex
CREATE UNIQUE INDEX "valuation_versions_valuation_id_version_number_key" ON "valuation_versions"("valuation_id", "version_number");

-- CreateIndex
CREATE INDEX "comparables_valuation_version_id_idx" ON "comparables"("valuation_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "comparables_valuation_version_id_source_ref_key" ON "comparables"("valuation_version_id", "source_ref");

-- CreateIndex
CREATE INDEX "market_references_city_id_residential_complex_id_rooms_idx" ON "market_references"("city_id", "residential_complex_id", "rooms");

-- CreateIndex
CREATE INDEX "market_references_city_id_district_id_idx" ON "market_references"("city_id", "district_id");

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_versions" ADD CONSTRAINT "valuation_versions_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_versions" ADD CONSTRAINT "valuation_versions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation_versions" ADD CONSTRAINT "valuation_versions_market_reference_id_fkey" FOREIGN KEY ("market_reference_id") REFERENCES "market_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparables" ADD CONSTRAINT "comparables_valuation_version_id_fkey" FOREIGN KEY ("valuation_version_id") REFERENCES "valuation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

