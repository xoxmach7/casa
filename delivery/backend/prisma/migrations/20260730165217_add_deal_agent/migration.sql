-- CreateEnum
CREATE TYPE "DealAgentActionType" AS ENUM ('STALLED_ALERT', 'STAGE_SUGGESTED', 'STAGE_APPLIED');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "stage_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "deal_agent_actions" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "action_type" "DealAgentActionType" NOT NULL,
    "from_stage" "DealStage" NOT NULL,
    "to_stage" "DealStage",
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_agent_actions_deal_id_idx" ON "deal_agent_actions"("deal_id");

-- CreateIndex
CREATE INDEX "deal_agent_actions_created_at_idx" ON "deal_agent_actions"("created_at");

-- AddForeignKey
ALTER TABLE "deal_agent_actions" ADD CONSTRAINT "deal_agent_actions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
