-- CreateEnum
CREATE TYPE "ClientPropertyLinkRole" AS ENUM ('SELLER', 'BUYER');

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_broker_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_seller_id_fkey";

-- DropTable
DROP TABLE "properties";

-- DropEnum
DROP TYPE "PropertyType";

-- CreateTable
CREATE TABLE "client_property_links" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "crm_property_id" TEXT NOT NULL,
    "role" "ClientPropertyLinkRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_property_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_property_links_client_id_idx" ON "client_property_links"("client_id");

-- CreateIndex
CREATE INDEX "client_property_links_crm_property_id_idx" ON "client_property_links"("crm_property_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_property_links_client_id_crm_property_id_role_key" ON "client_property_links"("client_id", "crm_property_id", "role");

-- AddForeignKey
ALTER TABLE "client_property_links" ADD CONSTRAINT "client_property_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_property_links" ADD CONSTRAINT "client_property_links_crm_property_id_fkey" FOREIGN KEY ("crm_property_id") REFERENCES "crm_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

