-- CreateEnum
CREATE TYPE "FixationStatus" AS ENUM ('DRAFT', 'SENT', 'DUPLICATE_CHECK', 'CONFIRMED', 'REJECTED_DUPLICATE', 'REJECTED_OTHER', 'EXPIRED', 'BOOKING_REQUESTED', 'BOOKED', 'DEAL', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ApprovalLikelihood" ADD VALUE 'INSUFFICIENT_DATA';

-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'MODERATION';
ALTER TYPE "PropertyStatus" ADD VALUE 'NEEDS_INFORMATION';
ALTER TYPE "PropertyStatus" ADD VALUE 'PAUSED';
ALTER TYPE "PropertyStatus" ADD VALUE 'OFFER_IN_PROGRESS';

-- AlterTable
ALTER TABLE "client_scorings" ADD COLUMN     "down_payment" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "max_property_price" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "fixations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "apartment_id" TEXT,
    "broker_id" TEXT NOT NULL,
    "status" "FixationStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixation_status_logs" (
    "id" TEXT NOT NULL,
    "fixation_id" TEXT NOT NULL,
    "from_status" "FixationStatus",
    "to_status" "FixationStatus" NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixation_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fixations_client_id_idx" ON "fixations"("client_id");

-- CreateIndex
CREATE INDEX "fixations_project_id_idx" ON "fixations"("project_id");

-- CreateIndex
CREATE INDEX "fixations_broker_id_idx" ON "fixations"("broker_id");

-- CreateIndex
CREATE INDEX "fixations_status_idx" ON "fixations"("status");

-- CreateIndex
CREATE INDEX "fixation_status_logs_fixation_id_idx" ON "fixation_status_logs"("fixation_id");

-- AddForeignKey
ALTER TABLE "fixations" ADD CONSTRAINT "fixations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixations" ADD CONSTRAINT "fixations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixations" ADD CONSTRAINT "fixations_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixations" ADD CONSTRAINT "fixations_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixation_status_logs" ADD CONSTRAINT "fixation_status_logs_fixation_id_fkey" FOREIGN KEY ("fixation_id") REFERENCES "fixations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
