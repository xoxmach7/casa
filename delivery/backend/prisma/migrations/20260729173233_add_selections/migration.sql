-- CreateTable
CREATE TABLE "selections" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "broker_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selection_apartments" (
    "id" TEXT NOT NULL,
    "selection_id" TEXT NOT NULL,
    "apartment_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_apartments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "selections_broker_id_idx" ON "selections"("broker_id");

-- CreateIndex
CREATE INDEX "selections_client_id_idx" ON "selections"("client_id");

-- CreateIndex
CREATE INDEX "selection_apartments_selection_id_idx" ON "selection_apartments"("selection_id");

-- CreateIndex
CREATE INDEX "selection_apartments_apartment_id_idx" ON "selection_apartments"("apartment_id");

-- CreateIndex
CREATE UNIQUE INDEX "selection_apartments_selection_id_apartment_id_key" ON "selection_apartments"("selection_id", "apartment_id");

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_apartments" ADD CONSTRAINT "selection_apartments_selection_id_fkey" FOREIGN KEY ("selection_id") REFERENCES "selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_apartments" ADD CONSTRAINT "selection_apartments_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
