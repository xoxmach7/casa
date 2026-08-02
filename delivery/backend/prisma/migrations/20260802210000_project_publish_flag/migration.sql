-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "projects_is_published_idx" ON "projects"("is_published");

