-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('DRAFT', 'SHARED', 'VIEWED', 'CLIENT_SELECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ESTIMATED', 'EXPECTED', 'CONFIRMED', 'INVOICED', 'RECEIVED', 'PAYABLE_TO_PARTNER', 'PAID', 'DISPUTED', 'CANCELLED');

-- AlterTable: add shareToken as nullable first so existing rows (if any)
-- don't violate NOT NULL, backfill with gen_random_uuid()-style unique
-- values, then enforce NOT NULL + UNIQUE.
ALTER TABLE "selections" ADD COLUMN     "shareToken" TEXT;
ALTER TABLE "selections" ADD COLUMN     "status" "SelectionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "selections" ADD COLUMN     "viewed_at" TIMESTAMP(3);

UPDATE "selections" SET "shareToken" = 'sel_' || replace(gen_random_uuid()::text, '-', '') WHERE "shareToken" IS NULL;

ALTER TABLE "selections" ALTER COLUMN "shareToken" SET NOT NULL;

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "casa_share" DECIMAL(15,2),
    "partner_share" DECIMAL(15,2),
    "status" "CommissionStatus" NOT NULL DEFAULT 'ESTIMATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_status_logs" (
    "id" TEXT NOT NULL,
    "commission_id" TEXT NOT NULL,
    "from_status" "CommissionStatus",
    "to_status" "CommissionStatus" NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_deal_id_key" ON "commissions"("deal_id");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commission_status_logs_commission_id_idx" ON "commission_status_logs"("commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "selections_shareToken_key" ON "selections"("shareToken");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_status_logs" ADD CONSTRAINT "commission_status_logs_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
