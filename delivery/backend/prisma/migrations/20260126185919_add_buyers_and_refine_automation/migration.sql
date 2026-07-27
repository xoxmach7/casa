-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('NEW', 'THINKING', 'OFFER', 'REFUSAL', 'ARCHIVED');

-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "ai_recommendation" TEXT;

-- CreateTable
CREATE TABLE "crm_buyers" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "phone" TEXT NOT NULL,
    "budget" DECIMAL(15,2),
    "status" "BuyerStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "broker_id" TEXT NOT NULL,

    CONSTRAINT "crm_buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_shows" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feedback" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "property_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,

    CONSTRAINT "crm_shows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_buyers_broker_id_idx" ON "crm_buyers"("broker_id");

-- CreateIndex
CREATE INDEX "crm_buyers_status_idx" ON "crm_buyers"("status");

-- CreateIndex
CREATE INDEX "crm_shows_property_id_idx" ON "crm_shows"("property_id");

-- CreateIndex
CREATE INDEX "crm_shows_buyer_id_idx" ON "crm_shows"("buyer_id");

-- AddForeignKey
ALTER TABLE "crm_buyers" ADD CONSTRAINT "crm_buyers_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_shows" ADD CONSTRAINT "crm_shows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_shows" ADD CONSTRAINT "crm_shows_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "crm_buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
