-- Реальные ипотечные программы Казахстана вместо выдуманного демо-набора.
--
-- Брокеру нужен ответ «на какую программу клиент может рассчитывать», а его
-- нельзя дать по придуманным ставкам. Условия сведены из обзоров Krisha.kz за
-- 2026 год (новостройки и вторичка) — это отраслевой справочник, на который
-- брокеры и ориентируются. Рядом с каждой строкой хранится источник и дата,
-- чтобы через месяц было видно, что данные пора обновить.
--
-- Ставка хранится диапазоном: у большинства программ банк публикует «от … до …»,
-- и одна нижняя граница вводит в заблуждение. ГЭСВ хранится отдельно — клиент
-- сравнивает программы по нему.

ALTER TABLE "mortgage_programs"
  ADD COLUMN IF NOT EXISTS "interest_rate_to" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "apr_from" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "max_amount_kzt" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "source_url" TEXT,
  ADD COLUMN IF NOT EXISTS "rates_as_of" TIMESTAMP(3);

DELETE FROM "mortgage_programs";

INSERT INTO "mortgage_programs" (
  "id", "bank_name", "program_name", "interest_rate", "interest_rate_to", "apr_from",
  "min_down_payment", "max_term", "max_amount_kzt", "property_type", "requirements",
  "is_active", "source_url", "rates_as_of", "created_at", "updated_at"
) VALUES
-- ── Новостройки ──────────────────────────────────────────────────────────────
('mp_7_20_25', 'Госпрограмма (банки-участники)', '7-20-25', 7.00, 7.00, NULL,
 20.00, 300, 30000000.00, 'NEW_BUILDING',
 'Только готовое жильё. Лимит суммы зависит от города (Алматы, Астана, Шымкент — до 30 млн, регионы — до 20 млн). Не должно быть жилья в собственности. Заявки принимают Halyk, БЦК, Freedom, Евразийский, Bank RBK, ForteBank, Altyn Bank.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_nauryz', 'Отбасы банк', 'Наурыз', 7.00, 9.00, NULL,
 10.00, 228, 36000000.00, 'NEW_BUILDING',
 'Ставка зависит от категории заёмщика, взнос 10-20% — от наличия отделки. Жильё у партнёров банка. Приём заявок ограничен сроком действия программы.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_otbasy_30_70', 'Отбасы банк', '30/70', 7.00, 7.00, 7.30,
 30.00, 300, NULL, 'NEW_BUILDING',
 'Жильё у партнёров банка. ГЭСВ 7,3-9%.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_otbasy_svoi_dom', 'Отбасы банк', 'Свой дом', 6.00, 7.00, 6.20,
 20.00, 300, NULL, 'NEW_BUILDING',
 'Промежуточный заём 6-7% с переходом на жилищный 3,5-5% после накопления. Жильё у партнёров банка.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_bck_jana', 'Банк ЦентрКредит', 'JAÑA (под заклад)', 5.00, 15.45, 6.00,
 20.00, 180, 100000000.00, 'NEW_BUILDING',
 'Ставка зависит от размера заклада денег. Только готовые ЖК.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_forte_zaklad_nb', 'ForteBank', 'Под заклад', 5.00, 15.00, 5.20,
 30.00, 180, 100000000.00, 'NEW_BUILDING',
 'Ставка зависит от размера заклада (30-70%). Только готовые ЖК.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_halyk_partner', 'Halyk Bank', 'Партнёрская', 5.00, 18.50, 5.10,
 20.00, 240, NULL, 'NEW_BUILDING',
 'Субсидируемая застройщиком ставка на строящиеся ЖК партнёров банка.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_altyn_partner', 'Altyn Bank', 'Партнёрская', 0.10, 18.50, 0.10,
 20.00, 240, 175000000.00, 'NEW_BUILDING',
 'Субсидируемая ставка у застройщиков-партнёров банка.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_bck_ddu', 'Банк ЦентрКредит', 'Ипотека по ДДУ', 20.50, 22.30, 23.60,
 20.00, 180, NULL, 'NEW_BUILDING',
 'Строящееся жильё у застройщиков-партнёров банка.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_halyk_digital_nb', 'Halyk Bank', 'Цифровая ипотека', 20.50, 24.00, 23.00,
 20.00, 240, 175000000.00, 'NEW_BUILDING',
 'Рыночная программа на готовые ЖК.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_freedom_digital_nb', 'Freedom Bank', 'Цифровая ипотека', 22.00, 22.00, 24.50,
 20.00, 240, 70000000.00, 'NEW_BUILDING',
 'Только для зарплатных клиентов банка. Готовые ЖК.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-novostroyki-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

-- ── Вторичное жильё ─────────────────────────────────────────────────────────
('mp_halyk_digital_sec', 'Halyk Bank', 'Цифровая ипотека (с комиссией)', 20.50, 20.50, 23.00,
 20.00, 240, NULL, 'SECONDARY',
 'Кирпичные дома с 1960 года, панельные — с 1965. Сумма зависит от дохода.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_halyk_digital_sec_nc', 'Halyk Bank', 'Цифровая ипотека (без комиссии)', 22.00, 22.00, 24.40,
 20.00, 240, NULL, 'SECONDARY',
 'Кирпичные дома с 1960 года, панельные — с 1965. Сумма зависит от дохода.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_bck_standard_sec', 'Банк ЦентрКредит', 'Стандартная ипотека', 20.55, 20.55, 23.60,
 20.00, 180, 100000000.00, 'SECONDARY',
 'Дом не старше 2000 года, не менее 5 этажей. Предельная сумма зависит от региона и взноса.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_bck_jana_sec', 'Банк ЦентрКредит', 'JAÑA ипотека (под заклад)', 5.00, 15.45, 6.00,
 20.00, 180, 100000000.00, 'SECONDARY',
 'Дом с 1990 года. Ставка зависит от размера заклада денег.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_altyn_sec', 'Altyn Bank', 'Стандартная / цифровая', 22.30, 22.30, 24.90,
 20.00, 240, 175000000.00, 'SECONDARY',
 'Дом с 1976 года, не менее 5 этажей, монолит/панель/кирпич.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_forte_zaklad_sec', 'ForteBank', 'Под заклад', 5.00, 15.00, 5.20,
 30.00, 180, 100000000.00, 'SECONDARY',
 'Дом с 1987 года. Ставка зависит от размера заклада (30-70%).',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_nurbank_sec', 'Нурбанк', 'Стандартная ипотека', 20.00, 21.50, 22.90,
 20.00, 120, 70000000.00, 'SECONDARY',
 'Дом с 1975 года, кирпич/панель/монолит.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW()),

('mp_otbasy_zhil_sec', 'Отбасы банк', 'Жилищный заём', 3.50, 5.00, 3.60,
 50.00, 300, NULL, 'SECONDARY',
 'Система жилищных строительных сбережений: депозит от 3 лет, взнос не менее 50%.',
 true, 'https://krisha.kz/content/articles/2026/2026-ipoteka-na-vtorichku-2026-usloviya-vseh-bankov', '2026-09-04', NOW(), NOW());
