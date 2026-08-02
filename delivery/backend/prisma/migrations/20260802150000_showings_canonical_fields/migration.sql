-- CreateEnum
CREATE TYPE "ClientPropertyInterestStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShowStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ShowStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "ShowStatus" ADD VALUE 'AWAITING_SELLER_CONFIRMATION';
ALTER TYPE "ShowStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "ShowStatus" ADD VALUE 'RESCHEDULE_REQUESTED';
ALTER TYPE "ShowStatus" ADD VALUE 'NO_SHOW_BUYER';
ALTER TYPE "ShowStatus" ADD VALUE 'NO_SHOW_SELLER';
ALTER TYPE "ShowStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "crm_shows" ADD COLUMN     "access_mode" TEXT,
ADD COLUMN     "attendance_status" TEXT,
ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "confirmation_source" TEXT,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by" TEXT,
ADD COLUMN     "confirmed_end_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_start_at" TIMESTAMP(3),
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "feedback_status" TEXT,
ADD COLUMN     "internal_access_note" TEXT,
ADD COLUMN     "meeting_instructions_safe" TEXT,
ADD COLUMN     "next_step" TEXT,
ADD COLUMN     "proposed_end_at" TIMESTAMP(3),
ADD COLUMN     "proposed_start_at" TIMESTAMP(3),
ADD COLUMN     "showing_manager_id" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Almaty',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "client_property_interests" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "status" "ClientPropertyInterestStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_property_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_property_interests_property_id_idx" ON "client_property_interests"("property_id");

-- CreateIndex
CREATE INDEX "client_property_interests_buyer_id_idx" ON "client_property_interests"("buyer_id");

-- CreateIndex
CREATE INDEX "client_property_interests_broker_id_idx" ON "client_property_interests"("broker_id");

-- AddForeignKey
ALTER TABLE "client_property_interests" ADD CONSTRAINT "client_property_interests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_interests" ADD CONSTRAINT "client_property_interests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "crm_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_interests" ADD CONSTRAINT "client_property_interests_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

