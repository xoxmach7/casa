-- Привязка расчёта к конкретной квартире каталога.
--
-- До этого брокер вбивал стоимость квартиры руками: кнопка «Рассчитать ипотеку»
-- на карточке вела в модуль, но объект по дороге терялся. Отсюда две беды:
-- опечатка в девятизначном числе и устаревшая цена (застройщик поднял, а в
-- расчёте осталась старая). Теперь цель покупки может ссылаться на объект, и
-- цена читается у него в момент расчёта.
--
-- Источника два, как и в подборе квартир, и они взаимоисключающие: новостройка
-- (apartments) либо вторичка (crm_properties). Оба NULL — цена задана вручную,
-- прежнее поведение сохраняется без изменений.
ALTER TABLE "mortgage_purchase_goals"
  ADD COLUMN IF NOT EXISTS "target_apartment_id" TEXT,
  ADD COLUMN IF NOT EXISTS "target_crm_property_id" TEXT;

-- ON DELETE SET NULL: удалённая из каталога квартира обязана развязать расчёт,
-- а не унести его с собой. Сохранённая target_price_max при этом остаётся —
-- цифра, по которой уже считали, не должна исчезать задним числом.
ALTER TABLE "mortgage_purchase_goals"
  DROP CONSTRAINT IF EXISTS "mortgage_purchase_goals_target_apartment_id_fkey";
ALTER TABLE "mortgage_purchase_goals"
  ADD CONSTRAINT "mortgage_purchase_goals_target_apartment_id_fkey"
  FOREIGN KEY ("target_apartment_id") REFERENCES "apartments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mortgage_purchase_goals"
  DROP CONSTRAINT IF EXISTS "mortgage_purchase_goals_target_crm_property_id_fkey";
ALTER TABLE "mortgage_purchase_goals"
  ADD CONSTRAINT "mortgage_purchase_goals_target_crm_property_id_fkey"
  FOREIGN KEY ("target_crm_property_id") REFERENCES "crm_properties"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Одна цель — одна квартира. Два источника одновременно означали бы две цены
-- в одном расчёте, и выбор между ними стал бы неявным.
ALTER TABLE "mortgage_purchase_goals"
  DROP CONSTRAINT IF EXISTS "mortgage_purchase_goals_single_target";
ALTER TABLE "mortgage_purchase_goals"
  ADD CONSTRAINT "mortgage_purchase_goals_single_target"
  CHECK (num_nonnulls("target_apartment_id", "target_crm_property_id") <= 1);

CREATE INDEX IF NOT EXISTS "mortgage_purchase_goals_target_apartment_id_idx"
  ON "mortgage_purchase_goals"("target_apartment_id");
CREATE INDEX IF NOT EXISTS "mortgage_purchase_goals_target_crm_property_id_idx"
  ON "mortgage_purchase_goals"("target_crm_property_id");
