-- M06 CASA-CJ-1 (§29) + M05 purchase_goal.
--
-- 1) Снапшот расчёта получает три хэша §29 (input/output/replay), версию
--    канонизации, версии схемы/реестра формул и обязательную ссылку на снапшот
--    профиля M05 — без неё расчёт невоспроизводим.
-- 2) Прогон тоже связывается со снапшотом профиля (§21: sole profile data source).
-- 3) purchase_goal.target_price_max — единственный источник цены для CALC-F-001.
--
-- Прежние строки расчётов создавались до внедрения CASA-CJ-1 и не содержат
-- replay-контекста. Их НЕ удаляем и НЕ выдумываем им хэши: помечаем явным
-- маркером legacy, чтобы отличать невоспроизводимые исторические записи от
-- корректных. Новые записи всегда пишутся приложением.

-- --- M05 purchase_goal -------------------------------------------------------

CREATE TABLE "mortgage_purchase_goals" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "target_price_max" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "status" "MortgageProfileFieldStatus" NOT NULL DEFAULT 'UNKNOWN',
    "property_kind" TEXT,
    "region_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortgage_purchase_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mortgage_purchase_goals_profile_id_key"
    ON "mortgage_purchase_goals"("profile_id");

ALTER TABLE "mortgage_purchase_goals"
    ADD CONSTRAINT "mortgage_purchase_goals_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "mortgage_client_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- --- M06 calculation run -----------------------------------------------------

ALTER TABLE "mortgage_calculation_runs"
    ADD COLUMN "client_profile_snapshot_id" TEXT,
    ADD COLUMN "client_profile_snapshot_hash" TEXT;

UPDATE "mortgage_calculation_runs"
   SET "client_profile_snapshot_id" = 'legacy-pre-casa-cj1',
       "client_profile_snapshot_hash" = 'legacy-pre-casa-cj1'
 WHERE "client_profile_snapshot_id" IS NULL;

ALTER TABLE "mortgage_calculation_runs"
    ALTER COLUMN "client_profile_snapshot_id" SET NOT NULL,
    ALTER COLUMN "client_profile_snapshot_hash" SET NOT NULL;

-- --- M06 calculation snapshot ------------------------------------------------

ALTER TABLE "mortgage_calculation_snapshots"
    ADD COLUMN "schema_version" TEXT,
    ADD COLUMN "formula_registry_version" TEXT,
    ADD COLUMN "canonicalization_version" TEXT,
    ADD COLUMN "replay_hash" TEXT,
    ADD COLUMN "client_profile_snapshot_id" TEXT,
    ADD COLUMN "client_profile_snapshot_hash" TEXT,
    ADD COLUMN "replay_payload_json" JSONB;

UPDATE "mortgage_calculation_snapshots"
   SET "schema_version" = 'legacy-pre-casa-cj1',
       "formula_registry_version" = 'legacy-pre-casa-cj1',
       "canonicalization_version" = 'legacy-pre-casa-cj1',
       "replay_hash" = 'legacy-pre-casa-cj1',
       "client_profile_snapshot_id" = 'legacy-pre-casa-cj1',
       "client_profile_snapshot_hash" = 'legacy-pre-casa-cj1',
       "replay_payload_json" = '{}'::jsonb
 WHERE "canonicalization_version" IS NULL;

ALTER TABLE "mortgage_calculation_snapshots"
    ALTER COLUMN "schema_version" SET NOT NULL,
    ALTER COLUMN "formula_registry_version" SET NOT NULL,
    ALTER COLUMN "canonicalization_version" SET NOT NULL,
    ALTER COLUMN "replay_hash" SET NOT NULL,
    ALTER COLUMN "client_profile_snapshot_id" SET NOT NULL,
    ALTER COLUMN "client_profile_snapshot_hash" SET NOT NULL,
    ALTER COLUMN "replay_payload_json" SET NOT NULL;
