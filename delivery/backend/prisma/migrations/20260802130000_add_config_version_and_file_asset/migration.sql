-- CreateTable
CREATE TABLE "config_versions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT,
    "value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "checksum" TEXT,
    "owner_type" TEXT,
    "owner_id" TEXT,
    "uploaded_by" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "config_versions_key_effective_from_idx" ON "config_versions"("key", "effective_from");

-- CreateIndex
CREATE INDEX "config_versions_key_is_active_idx" ON "config_versions"("key", "is_active");

-- CreateIndex
CREATE INDEX "file_assets_owner_type_owner_id_idx" ON "file_assets"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "file_assets_uploaded_by_idx" ON "file_assets"("uploaded_by");

-- AddForeignKey
ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

