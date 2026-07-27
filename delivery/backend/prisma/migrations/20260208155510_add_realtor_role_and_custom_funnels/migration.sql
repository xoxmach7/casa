-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'REALTOR';
ALTER TYPE "UserRole" ADD VALUE 'AGENCY';

-- CreateTable
CREATE TABLE "custom_funnels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "order" INTEGER NOT NULL,
    "funnel_id" TEXT NOT NULL,

    CONSTRAINT "custom_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_stages_funnel_id_idx" ON "custom_stages"("funnel_id");

-- AddForeignKey
ALTER TABLE "custom_funnels" ADD CONSTRAINT "custom_funnels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_stages" ADD CONSTRAINT "custom_stages_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "custom_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
