-- CreateEnum
CREATE TYPE "DealRoomStage" AS ENUM ('OFFER_SUBMITTED', 'SELLER_REVIEW', 'COUNTEROFFER_SENT', 'PRICE_AGREED', 'PRECHECK_IN_PROGRESS', 'YELLOW_BLOCKED', 'GREEN_1', 'GREEN_2', 'DEPOSIT_AGREEMENT_DRAFTING', 'DEPOSIT_AGREEMENT_SENT', 'DEPOSIT_AGREEMENT_SIGNED', 'DEPOSIT_TRANSFER_PENDING', 'BOOKING_ACTIVE', 'PAYMENT_ROUTE_IN_PROGRESS', 'READY_FOR_NOTARY', 'NOTARY_SCHEDULED', 'REGISTRATION_OR_DISBURSEMENT', 'SOLD', 'FAILED');

-- CreateEnum
CREATE TYPE "DealRoomTrafficLight" AS ENUM ('RED', 'YELLOW', 'GREEN_1', 'GREEN_2');

-- CreateEnum
CREATE TYPE "DealRoomPaymentRoute" AS ENUM ('CASH', 'BVU', 'OTBASY', 'MIXED');

-- CreateEnum
CREATE TYPE "DealDepositStatus" AS ENUM ('NOT_ALLOWED', 'DRAFTING', 'SENT', 'SIGNED', 'TRANSFER_PENDING', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealBookingStatus" AS ENUM ('NOT_CREATED', 'PENDING_CONFIRMATION', 'ACTIVE', 'EXPIRING_SOON', 'EXTENDED', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_SOLD');

-- CreateEnum
CREATE TYPE "DealRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "secondary_deals" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "coordinator_id" TEXT,
    "stage" "DealRoomStage" NOT NULL DEFAULT 'OFFER_SUBMITTED',
    "traffic_light" "DealRoomTrafficLight" NOT NULL DEFAULT 'RED',
    "payment_route" "DealRoomPaymentRoute",
    "final_price" DECIMAL(15,2),
    "version" INTEGER NOT NULL DEFAULT 1,
    "outcome_at" TIMESTAMP(3),
    "outcome_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secondary_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_prechecks" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "buyer_verified" BOOLEAN NOT NULL DEFAULT false,
    "seller_verified" BOOLEAN NOT NULL DEFAULT false,
    "property_verified" BOOLEAN NOT NULL DEFAULT false,
    "payment_route_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "completeness_percent" INTEGER NOT NULL DEFAULT 0,
    "has_blocking_risk" BOOLEAN NOT NULL DEFAULT false,
    "missing_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "mortgage_part_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_prechecks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_deposits" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2),
    "contract_ref" TEXT,
    "status" "DealDepositStatus" NOT NULL DEFAULT 'NOT_ALLOWED',
    "proof_type" TEXT,
    "proof_file_asset_id" TEXT,
    "coordinator_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_bookings" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "status" "DealBookingStatus" NOT NULL DEFAULT 'NOT_CREATED',
    "expiry_at" TIMESTAMP(3),
    "coordinator_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_risks" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "DealRiskSeverity" NOT NULL DEFAULT 'MEDIUM',
    "is_blocker" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT,
    "due_date" TIMESTAMP(3),
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "secondary_deals_offer_id_key" ON "secondary_deals"("offer_id");

-- CreateIndex
CREATE INDEX "secondary_deals_property_id_idx" ON "secondary_deals"("property_id");

-- CreateIndex
CREATE INDEX "secondary_deals_buyer_id_idx" ON "secondary_deals"("buyer_id");

-- CreateIndex
CREATE INDEX "secondary_deals_stage_idx" ON "secondary_deals"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "deal_prechecks_deal_id_key" ON "deal_prechecks"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_deposits_deal_id_key" ON "deal_deposits"("deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_bookings_deal_id_key" ON "deal_bookings"("deal_id");

-- CreateIndex
CREATE INDEX "deal_risks_deal_id_idx" ON "deal_risks"("deal_id");

-- AddForeignKey
ALTER TABLE "secondary_deals" ADD CONSTRAINT "secondary_deals_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_deals" ADD CONSTRAINT "secondary_deals_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "crm_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_deals" ADD CONSTRAINT "secondary_deals_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "crm_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_deals" ADD CONSTRAINT "secondary_deals_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_prechecks" ADD CONSTRAINT "deal_prechecks_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "secondary_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_deposits" ADD CONSTRAINT "deal_deposits_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "secondary_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_bookings" ADD CONSTRAINT "deal_bookings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "secondary_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_risks" ADD CONSTRAINT "deal_risks_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "secondary_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_risks" ADD CONSTRAINT "deal_risks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

