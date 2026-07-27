-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('CLIENT_REFUSED', 'WE_REFUSED');

-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "cancellation_comment" TEXT,
ADD COLUMN     "cancellation_reason" "CancellationReason";

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "cancellation_comment" TEXT,
ADD COLUMN     "cancellation_reason" "CancellationReason";
