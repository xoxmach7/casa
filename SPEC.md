# Casa — Техническое задание и план разработки

Черновик собран из брифа заказчика, референса casavo.com и разбора существующей
Airtable-базы «Casa Airtable System» (Астана, рынок жилой недвижимости, источник
сравнимых объявлений — krisha.kz).

---

## 1. Концепция

Двусторонняя платформа по модели Casavo (iBuyer / гибридный маркетплейс):

- **Продавец**: вводит адрес и параметры квартиры → получает две цены (срочная
  выкупная и рыночная) → соглашается → подписывает договор через ЭЦП/СМС →
  делается фотосессия/3D-тур → объект уходит в продажу.
- **Покупатель**: смотрит каталог подготовленных объектов → система подбора →
  запись на показ → сделка.

## 2. Что уже существует (Airtable-прототип)

В Airtable уже реализована рабочая версия оценочного движка. Это не просто
хранилище данных, а действующая связка таблиц + формул + автоматизации.

### 2.1 Иерархия локации
`Districts` (районы Астаны: Esil, Baikonur, Saryarka, Sarayshyq, Nura) →
`Location_Zones` → `Residential_Complexes` (ЖК) → `Buildings` → `Entrances`

### 2.2 Таблица Buildings (характеристики дома)
`building_class` (economy/comfort/comfort_plus/business), `building_generation`
(2000_2009…2020_plus), `market_generation` (early_new_building/modern_comfort/
modern_mass_market), `construction_material` (brick/monolith), `total_floors`,
`building_ceiling_height`, `entrance_count`, `building_age_years`,
`building_status` (checked — флаг верификации), `parking_type`
(underground/ground/none), `lift_type` (freight/passenger).

### 2.3 Таблица Objects (сама квартира — ядро системы)
- Идентификация и адрес: `seller_link`, `city`, `district_link`,
  `location_zone_link`, `rc_link`, `building_link`, `entrance_link`,
  `address_hint`, `exact_address_confidence`, `address_confidence`,
  `address_review_required`, `map_latitude/longitude`, `map_status`
- Параметры квартиры: `rooms`, `area_m2`, `ceiling_height_m`, `floor`,
  `room_category` (1_full…5_plus, 2_studio), `layout_format`
  (classic/euro), `kitchen_format` (separate_kitchen/kitchen_living)
- Состояние: `repair_category`/`repair_condition` (fresh_repair/old_livable/
  cosmetic/good_livable), `repair_claim_confidence`, `finish_strategy_segment`,
  `move_in_readiness`, `furniture_appliances`
- Производные bucket-поля для модели: `floor_position_category`
  (first/middle/near_top/top_floor), `area_bucket`, `ceiling_height_bucket`
- Продавец и сделка: `seller_expected_price`, `sale_timeline` (fast/normal),
  `seller_readiness_level`, `seller_consent_status/source/date`
  (website_form/manual — уже трекается согласие на обработку данных)
- Фото/показы: `photos_status`, `photos_upload`, `photo_package_status`,
  `showing_availability`
- Расчёт цены (формулы): `rc_1k/2k/3k_price_m2_lookup` (цена м² по ЖК в
  разрезе комнатности, из Comparables), `instant_price_per_m2`,
  `instant_market_range_min/max`, `seller_instant_preliminary` (текст
  «Предварительный ориентир» / «Данных пока недостаточно»),
  `instant_orientir_ready`, `instant_orientir_sent` (+ дата) — автоматическая
  отправка предварительной оценки на `seller_email_lookup`
- Служебное: `duplicate_review_required`, `possible_duplicate`, `source`,
  `owner`, `created_at`, `last_modified_at`, `internal_notes`

### 2.4 Остальные таблицы
- **Comparables** — аналоги, спарсенные с krisha.kz (`listing_url`,
  `raw_listing_text`, `listing_price`), с флагом `comp_is_stale` для
  переоценки устаревших
- **Valuations** — отдельная таблица снимков расчёта, привязанная к Objects
  (историчность оценок)
- **Market_Snapshots**, **Forecasts** — динамика рынка во времени
- **Photos**, **Activity_Log** — медиа и аудит действий

### 2.5 Гипотеза по логике расчёта (требует подтверждения с заказчиком)
Похоже, цена за м² сначала агрегируется по ЖК и комнатности из живых
аналогов (`rc_Nk_price_m2`), затем для конкретного объекта считается
`instant_price_per_m2` и диапазон `instant_market_range` с учётом этажа,
площади, состояния и класса дома. «Срочная» цена — предположительно нижняя
граница/дисконт от рыночного диапазона. **Точную формулу дисконта нужно
уточнить у того, кто строил модель** — по данным Airtable это не читается
однозначно.

## 3. Целевая архитектура (перенос в production)

| Airtable таблица | Production (PostgreSQL) |
|---|---|
| Districts, Location_Zones | `districts`, `location_zones` |
| Residential_Complexes | `residential_complexes` |
| Buildings, Entrances | `buildings`, `entrances` |
| Objects | `listings` (+ `sellers`) |
| Comparables | `comparables` (с источником krisha.kz, нужен парсер/интеграция) |
| Valuations | `valuations` (снимки расчёта, append-only) |
| Market_Snapshots, Forecasts | `market_snapshots`, `forecasts` |
| Photos | S3-совместимое хранилище + таблица метаданных |
| Activity_Log | `audit_log` |
| seller_consent_* | `consents` (отдельная таблица, юридически значимая) |

Гео-поля (`map_latitude/longitude`) говорят, что нужна интеграция с картой —
для Казахстана/Астаны разумнее **2GIS API**, чем Google Maps (лучше покрытие
и точность адресов в РК).

## 4. Рекомендация: сайт или веб-приложение

Одна кодовая база, два слоя:
- **Публичный сайт** (SSR/SSG, SEO) — лендинг, каталог, форма оценки
- **Веб-приложение / личный кабинет** (SPA поверх той же базы) — кабинет
  продавца (статус, согласие, договор, ЭЦП), кабинет покупателя (подбор,
  показы), внутренняя CRM для команды (координация фотосессий и показов)

Технологический стек:
- Frontend: **Next.js** (React), адаптивно под мобильные — нативное
  приложение на старте не нужно
- Backend: Node.js (NestJS) или аналог, REST/GraphQL API
- DB: **PostgreSQL** (+ PostGIS для геоданных)
- Карты/геокодинг: **2GIS API**
- Хранилище медиа: S3-совместимое + 3D-тур (Matterport или собственный viewer)
- Email/уведомления: продолжить логику из Airtable (сейчас похоже на
  Resend-подобный флоу отправки «ориентира» продавцу)
- ЭЦП/СМС-подпись: провайдер под РК — нужно уточнить (НУЦ РК / eGov для
  юридически значимой ЭЦП, либо СМС-подпись через локальный агрегатор)

## 5. Полный флоу продавца (по данным Airtable + брифу)

1. Веб-форма: адрес + параметры квартиры (`website_form` уже источник)
2. Автосопоставление адреса с иерархией District→Zone→RC→Building→Entrance,
   контроль уверенности (`address_confidence`, `map_status`)
3. Расчёт предварительного ориентира (срочная/рыночная цена), автоматическая
   отправка продавцу на email
4. Продавец соглашается → фиксация согласия (`seller_consent_status/source/date`)
   → расширенная анкета (ремонт, мебель, готовность к показу)
5. Планирование фотосессии/3D-тура (`sale_timeline` fast/normal определяет
   приоритет выезда фотографа)
6. Формирование договора и подпись ЭЦП/СМС
7. Публикация объекта в каталог

## 6. Флоу покупателя

1. Каталог готовых (сфотографированных) объектов
2. Подбор — фильтры по району/ЖК/комнатности/площади/бюджету, возможно
   рекомендации
3. Запись на показ (`showing_availability`)
4. Сделка

## 7. Открытые вопросы к заказчику

1. Кто владелец Airtable-базы и есть ли документация по формуле расчёта
   «срочной» vs «рыночной» цены?
2. Какой провайдер ЭЦП/СМС-подписи планируется для РК?
3. Есть ли готовый шаблон договора купли-продажи от юриста?
4. Нужна ли внутренняя CRM-панель команде сразу в первом релизе?
5. Бюджет и целевые сроки запуска?

## 8. План разработки (единый релиз, с внутренней последовательностью)

1. Инфраструктура: схема PostgreSQL, ETL-перенос данных из Airtable, auth
2. Оценочный модуль: форма + расчёт + API (перенос логики из Airtable-формул)
3. Личный кабинет продавца: согласие, анкета, статус сделки
4. Модуль фотосессии/3D-тура + генерация договора + ЭЦП/СМС
5. Публичный каталог + подбор для покупателя
6. Показы + внутренняя CRM-панель
7. QA, юридическая проверка, запуск
