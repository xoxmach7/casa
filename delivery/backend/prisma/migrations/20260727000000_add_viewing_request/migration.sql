-- CreateTable
CREATE TABLE "viewing_requests" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "viewing_requests_property_id_idx" ON "viewing_requests"("property_id");

-- AddForeignKey
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
