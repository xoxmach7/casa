-- CreateEnum
CREATE TYPE "PublicListingStatus" AS ENUM ('NEW', 'PUBLISHED', 'SHOWING', 'IN_DEAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicListingPaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "description" TEXT,
ADD COLUMN     "negotiable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ready_to_move_in" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public_listing_ops" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "status" "PublicListingStatus" NOT NULL DEFAULT 'NEW',
    "selected_lead_id" TEXT,
    "payment_status" "PublicListingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_amount" DECIMAL(15,2),
    "payment_receipt_file_id" TEXT,
    "payment_comment" TEXT,
    "verification_checklist" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_listing_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_listing_leads" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_name" TEXT NOT NULL,
    "buyer_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "comment" TEXT,
    "financing_type" TEXT,
    "financing_bank" TEXT,
    "pre_approved" BOOLEAN,
    "mortgage_amount" DECIMAL(15,2),
    "expected_timeline" TEXT,
    "viewing_datetime" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_listing_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_listing_ops_property_id_key" ON "public_listing_ops"("property_id");

-- CreateIndex
CREATE INDEX "public_listing_leads_property_id_idx" ON "public_listing_leads"("property_id");

-- AddForeignKey
ALTER TABLE "public_listing_ops" ADD CONSTRAINT "public_listing_ops_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_listing_ops" ADD CONSTRAINT "public_listing_ops_selected_lead_id_fkey" FOREIGN KEY ("selected_lead_id") REFERENCES "public_listing_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_listing_leads" ADD CONSTRAINT "public_listing_leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

