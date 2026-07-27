/*
  Warnings:

  - The values [THINKING,OFFER] on the enum `BuyerStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `budget` on the `crm_buyers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "BuyerStatus_new" AS ENUM ('NEW', 'ACTIVE', 'OFFER_MADE', 'ARCHIVED', 'REFUSAL');
ALTER TABLE "public"."crm_buyers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "crm_buyers" ALTER COLUMN "status" TYPE "BuyerStatus_new" USING ("status"::text::"BuyerStatus_new");
ALTER TYPE "BuyerStatus" RENAME TO "BuyerStatus_old";
ALTER TYPE "BuyerStatus_new" RENAME TO "BuyerStatus";
DROP TYPE "public"."BuyerStatus_old";
ALTER TABLE "crm_buyers" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyFunnelStage" ADD VALUE 'SOLD';
ALTER TYPE "PropertyFunnelStage" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "SellerFunnelStage" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "crm_buyers" DROP COLUMN "budget",
ADD COLUMN     "max_budget" DECIMAL(15,2),
ADD COLUMN     "min_budget" DECIMAL(15,2),
ADD COLUMN     "preferences" JSONB;

-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "has_panoramic_windows" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktok_url" TEXT;

-- AlterTable
ALTER TABLE "crm_shows" ADD COLUMN     "feedback_sentiment" "FeedbackSentiment",
ADD COLUMN     "status" "ShowStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "city" TEXT,
ADD COLUMN     "communication_channel" TEXT,
ADD COLUMN     "loan_payment_amount" DECIMAL(15,2),
ADD COLUMN     "preferred_time" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "crm_offers" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,

    CONSTRAINT "crm_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "crm_offers_property_id_idx" ON "crm_offers"("property_id");

-- CreateIndex
CREATE INDEX "crm_offers_buyer_id_idx" ON "crm_offers"("buyer_id");

-- AddForeignKey
ALTER TABLE "crm_offers" ADD CONSTRAINT "crm_offers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_offers" ADD CONSTRAINT "crm_offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "crm_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
