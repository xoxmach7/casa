-- M06 §21: calculation_run хранит ПОЛНЫЙ frozen execution context.
--
-- Прогон должен быть воспроизводим по одной своей записи: область доступа,
-- участники, ссылки upstream, выбранные формулы с версиями, параметры с
-- провенансом, реестр, результаты, блокеры, время и идемпотентность.
--
-- Исторические строки создавались до этого контракта. Реконструировать их
-- контекст задним числом нельзя — это было бы выдумыванием провенанса, поэтому
-- они помечаются 'legacy-pre-run-context' / пустыми структурами и остаются
-- отличимыми от корректных прогонов.

-- --- M01: included_in_analysis ----------------------------------------------
-- M01-CAN-0139/0140: супруг и созаёмщик включаются в анализ ТОЛЬКО явно,
-- поэтому значение по умолчанию false. Основной заёмщик — true по своей роли.

ALTER TABLE "mortgage_case_parties"
    ADD COLUMN "included_in_analysis" BOOLEAN NOT NULL DEFAULT false;

UPDATE "mortgage_case_parties"
   SET "included_in_analysis" = true
 WHERE "role" = 'PRIMARY';

-- --- M06 calculation_run: execution context ---------------------------------

ALTER TABLE "mortgage_calculation_runs"
    ADD COLUMN "tenant_id" TEXT,
    ADD COLUMN "tenant_scope_kind" TEXT NOT NULL DEFAULT 'CASE_OWNER',
    ADD COLUMN "formula_registry_version" TEXT,
    ADD COLUMN "participant_scope_json" JSONB,
    ADD COLUMN "selected_upstream_refs_json" JSONB,
    ADD COLUMN "requested_calculations_json" JSONB,
    ADD COLUMN "parameters_json" JSONB,
    ADD COLUMN "results_json" JSONB,
    ADD COLUMN "blockers_json" JSONB,
    ADD COLUMN "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "idempotency_key" TEXT,
    ADD COLUMN "request_hash" TEXT;

-- Область доступа исторических прогонов известна точно: владелец кейса.
UPDATE "mortgage_calculation_runs" r
   SET "tenant_id" = c."owner_id"
  FROM "mortgage_cases" c
 WHERE c."id" = r."case_id"
   AND r."tenant_id" IS NULL;

UPDATE "mortgage_calculation_runs"
   SET "tenant_id" = COALESCE("tenant_id", 'legacy-pre-run-context'),
       "formula_registry_version" = 'legacy-pre-run-context',
       "participant_scope_json" = '[]'::jsonb,
       "selected_upstream_refs_json" = '{}'::jsonb,
       "requested_calculations_json" = '[]'::jsonb,
       "parameters_json" = '{}'::jsonb,
       "results_json" = '{}'::jsonb,
       "blockers_json" = '[]'::jsonb,
       "idempotency_key" = 'legacy-pre-run-context',
       "request_hash" = 'legacy-pre-run-context'
 WHERE "formula_registry_version" IS NULL;

ALTER TABLE "mortgage_calculation_runs"
    ALTER COLUMN "tenant_id" SET NOT NULL,
    ALTER COLUMN "formula_registry_version" SET NOT NULL,
    ALTER COLUMN "participant_scope_json" SET NOT NULL,
    ALTER COLUMN "selected_upstream_refs_json" SET NOT NULL,
    ALTER COLUMN "requested_calculations_json" SET NOT NULL,
    ALTER COLUMN "parameters_json" SET NOT NULL,
    ALTER COLUMN "results_json" SET NOT NULL,
    ALTER COLUMN "blockers_json" SET NOT NULL,
    ALTER COLUMN "idempotency_key" SET NOT NULL,
    ALTER COLUMN "request_hash" SET NOT NULL;

-- --- M06 calculation_snapshot: tenant + calculated_at ------------------------
-- DC-M06-CAN-0059: tenant_id в envelope обязателен.

ALTER TABLE "mortgage_calculation_snapshots"
    ADD COLUMN "tenant_id" TEXT,
    ADD COLUMN "tenant_scope_kind" TEXT NOT NULL DEFAULT 'CASE_OWNER',
    ADD COLUMN "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "mortgage_calculation_snapshots" s
   SET "tenant_id" = c."owner_id"
  FROM "mortgage_cases" c
 WHERE c."id" = s."case_id"
   AND s."tenant_id" IS NULL;

UPDATE "mortgage_calculation_snapshots"
   SET "tenant_id" = 'legacy-pre-run-context'
 WHERE "tenant_id" IS NULL;

ALTER TABLE "mortgage_calculation_snapshots"
    ALTER COLUMN "tenant_id" SET NOT NULL;
