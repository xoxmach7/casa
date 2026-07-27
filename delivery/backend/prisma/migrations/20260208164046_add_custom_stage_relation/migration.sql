-- AlterTable
ALTER TABLE "crm_properties" ADD COLUMN     "custom_stage_id" TEXT;

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "custom_stage_id" TEXT;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_custom_stage_id_fkey" FOREIGN KEY ("custom_stage_id") REFERENCES "custom_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_properties" ADD CONSTRAINT "crm_properties_custom_stage_id_fkey" FOREIGN KEY ("custom_stage_id") REFERENCES "custom_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
