-- AlterTable: особенности и «что интересного рядом» на ЖК
ALTER TABLE "projects" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nearby" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: обратная связь пользователей CRM
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "role" TEXT,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_resolved_idx" ON "feedback"("resolved");
