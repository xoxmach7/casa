-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "apartment_id" TEXT;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "apartments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
