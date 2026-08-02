-- AlterTable
ALTER TABLE "selections" ADD COLUMN     "selected_crm_property_id" TEXT;

-- CreateTable
CREATE TABLE "selection_crm_properties" (
    "id" TEXT NOT NULL,
    "selection_id" TEXT NOT NULL,
    "crm_property_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_crm_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "selection_crm_properties_selection_id_idx" ON "selection_crm_properties"("selection_id");

-- CreateIndex
CREATE INDEX "selection_crm_properties_crm_property_id_idx" ON "selection_crm_properties"("crm_property_id");

-- CreateIndex
CREATE UNIQUE INDEX "selection_crm_properties_selection_id_crm_property_id_key" ON "selection_crm_properties"("selection_id", "crm_property_id");

-- AddForeignKey
ALTER TABLE "selection_crm_properties" ADD CONSTRAINT "selection_crm_properties_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_crm_properties" ADD CONSTRAINT "selection_crm_properties_crm_property_id_fkey" FOREIGN KEY ("crm_property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

