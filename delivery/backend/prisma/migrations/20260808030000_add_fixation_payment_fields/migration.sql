-- CreateEnum
CREATE TYPE "FixationPaymentMethod" AS ENUM ('FULL', 'MORTGAGE', 'INSTALLMENT');

-- AlterTable
ALTER TABLE "fixations" ADD COLUMN "payment_method" "FixationPaymentMethod",
ADD COLUMN "deal_amount" DECIMAL(15,2);
