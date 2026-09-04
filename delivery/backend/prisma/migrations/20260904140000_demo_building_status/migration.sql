-- Статус стройки демо-ЖК был случайным (faker выбирал COMPLETED/UNDER_CONSTRUCTION
-- независимо от даты сдачи), и на карточке получалось «Сдан» рядом с «дек. 2027 г.».
-- Приводим статус в соответствие с датой: срок в будущем — строится, в прошлом — сдан.
UPDATE "projects" SET
  "building_status" = CASE
    WHEN "delivery_date" IS NULL OR "delivery_date" > NOW() THEN 'UNDER_CONSTRUCTION'
    ELSE 'COMPLETED'
  END::"BuildingStatus"
WHERE "developer_name" = 'Кемел Құрылыс';
