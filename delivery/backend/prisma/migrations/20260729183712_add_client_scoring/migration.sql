-- CreateEnum
CREATE TYPE "CreditHistoryStatus" AS ENUM ('GOOD', 'HAS_DELAYS', 'BAD');

-- CreateEnum
CREATE TYPE "ApprovalLikelihood" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "client_scorings" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "credit_history_status" "CreditHistoryStatus" NOT NULL,
    "avg_monthly_pension" DECIMAL(15,2) NOT NULL,
    "existing_monthly_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "score_value" INTEGER NOT NULL,
    "approval_likelihood" "ApprovalLikelihood" NOT NULL,
    "max_loan_amount" DECIMAL(15,2) NOT NULL,
    "max_monthly_payment" DECIMAL(15,2) NOT NULL,
    "advice" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_scorings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_scorings_client_id_idx" ON "client_scorings"("client_id");

-- AddForeignKey
ALTER TABLE "client_scorings" ADD CONSTRAINT "client_scorings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
