-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('LEGACY', 'OWNER_SELF', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "ListingTier" AS ENUM ('BASIC', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "ListingAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SecondaryFixationStatus" AS ENUM ('DRAFT', 'SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'SHOWN', 'OFFER_MADE', 'DEAL', 'REJECTED_DUPLICATE', 'REJECTED_OTHER', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingExitOutcome" AS ENUM ('SOLD_VIA_PLATFORM', 'SOLD_OUTSIDE', 'NOT_SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MarketplacePlan" AS ENUM ('TRIAL', 'START', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MarketplaceSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "partner_agent_id" TEXT,
ADD COLUMN     "secondary_deal_id" TEXT,
ALTER COLUMN "deal_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "listing_source" "ListingSource" NOT NULL DEFAULT 'LEGACY';

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "listing_agreements" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "tier" "ListingTier" NOT NULL DEFAULT 'BASIC',
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "buyer_agent_share_percent" DECIMAL(5,2) NOT NULL,
    "protection_period_days" INTEGER NOT NULL,
    "status" "ListingAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "accepted_at" TIMESTAMP(3),
    "acceptance_evidence" TEXT,
    "expires_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "termination_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secondary_fixations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "buyer_identity_hash" TEXT NOT NULL,
    "status" "SecondaryFixationStatus" NOT NULL DEFAULT 'DRAFT',
    "declared_share_percent" DECIMAL(5,2) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "protection_until" TIMESTAMP(3) NOT NULL,
    "rejection_reason" TEXT,
    "secondary_deal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secondary_fixations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secondary_fixation_status_logs" (
    "id" TEXT NOT NULL,
    "fixation_id" TEXT NOT NULL,
    "from_status" "SecondaryFixationStatus",
    "to_status" "SecondaryFixationStatus" NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secondary_fixation_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_exits" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "outcome" "ListingExitOutcome" NOT NULL,
    "buyer_identity_hash" TEXT,
    "declared_price" DECIMAL(15,2),
    "declared_by" TEXT NOT NULL,
    "comment" TEXT,
    "matched_fixation_id" TEXT,
    "dispute_opened" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_exits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_subscriptions" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "plan" "MarketplacePlan" NOT NULL DEFAULT 'TRIAL',
    "status" "MarketplaceSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_active_fixations" INTEGER NOT NULL,
    "max_agents" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "amount" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_agreements_property_id_idx" ON "listing_agreements"("property_id");

-- CreateIndex
CREATE INDEX "listing_agreements_seller_id_idx" ON "listing_agreements"("seller_id");

-- CreateIndex
CREATE INDEX "listing_agreements_status_idx" ON "listing_agreements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "secondary_fixations_secondary_deal_id_key" ON "secondary_fixations"("secondary_deal_id");

-- CreateIndex
CREATE INDEX "secondary_fixations_property_id_idx" ON "secondary_fixations"("property_id");

-- CreateIndex
CREATE INDEX "secondary_fixations_agent_id_idx" ON "secondary_fixations"("agent_id");

-- CreateIndex
CREATE INDEX "secondary_fixations_status_idx" ON "secondary_fixations"("status");

-- CreateIndex
CREATE INDEX "secondary_fixations_buyer_identity_hash_idx" ON "secondary_fixations"("buyer_identity_hash");

-- CreateIndex
CREATE INDEX "secondary_fixations_property_id_buyer_identity_hash_idx" ON "secondary_fixations"("property_id", "buyer_identity_hash");

-- CreateIndex
CREATE INDEX "secondary_fixation_status_logs_fixation_id_idx" ON "secondary_fixation_status_logs"("fixation_id");

-- CreateIndex
CREATE INDEX "listing_exits_property_id_idx" ON "listing_exits"("property_id");

-- CreateIndex
CREATE INDEX "listing_exits_buyer_identity_hash_idx" ON "listing_exits"("buyer_identity_hash");

-- CreateIndex
CREATE INDEX "agency_subscriptions_agency_id_idx" ON "agency_subscriptions"("agency_id");

-- CreateIndex
CREATE INDEX "agency_subscriptions_status_idx" ON "agency_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_secondary_deal_id_key" ON "commissions"("secondary_deal_id");

-- CreateIndex
CREATE INDEX "commissions_partner_agent_id_idx" ON "commissions"("partner_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_secondary_deal_id_fkey" FOREIGN KEY ("secondary_deal_id") REFERENCES "secondary_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partner_agent_id_fkey" FOREIGN KEY ("partner_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_agreements" ADD CONSTRAINT "listing_agreements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_agreements" ADD CONSTRAINT "listing_agreements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixations" ADD CONSTRAINT "secondary_fixations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixations" ADD CONSTRAINT "secondary_fixations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "crm_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixations" ADD CONSTRAINT "secondary_fixations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixations" ADD CONSTRAINT "secondary_fixations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixations" ADD CONSTRAINT "secondary_fixations_secondary_deal_id_fkey" FOREIGN KEY ("secondary_deal_id") REFERENCES "secondary_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_fixation_status_logs" ADD CONSTRAINT "secondary_fixation_status_logs_fixation_id_fkey" FOREIGN KEY ("fixation_id") REFERENCES "secondary_fixations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_exits" ADD CONSTRAINT "listing_exits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_exits" ADD CONSTRAINT "listing_exits_declared_by_fkey" FOREIGN KEY ("declared_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =========================================================================
-- Инварианты, которые Prisma не выражает декларативно, но БД выражает.
-- Держать их в сервисе одном мало: гейты раздела 6 спеки должны быть
-- невозможны к обходу, а не «проверяются в одном месте».
-- =========================================================================

-- Комиссия принадлежит ровно одной сделке: либо новостройке, либо вторичке.
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_exactly_one_deal"
  CHECK ((("deal_id" IS NOT NULL)::int + ("secondary_deal_id" IS NOT NULL)::int) = 1);

-- Не более одного действующего договора на объект.
CREATE UNIQUE INDEX "listing_agreements_one_active_per_property"
  ON "listing_agreements"("property_id") WHERE "status" = 'ACTIVE';

-- Не более одной живой фиксации одного покупателя на один объект —
-- дубль-чек на уровне БД, а не только в fixation.service.ts.
CREATE UNIQUE INDEX "secondary_fixations_one_live_per_property_buyer"
  ON "secondary_fixations"("property_id", "buyer_identity_hash")
  WHERE "status" IN ('SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'SHOWN', 'OFFER_MADE');
