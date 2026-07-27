# Casa ⇄ Pro-Casa Integration Design

## Что это

`casa` (Next.js, публичный сайт для Алматы: лендинг, мастер оценки, каталог объявлений, форма приёма квартир) становится публичным фронтендом уже существующей CRM **pro-casa** (`delivery/backend` — Express/Prisma/Postgres, продакшн на pro-casa.kz; `delivery/frontend` — CRM-панель брокеров). Один backend, одна база данных — на публичный сайт и на CRM.

Ничего из ранее обсуждавшегося отдельного Supabase-бэкенда, SMS-авторизации продавца или отдельного кабинета владельца квартиры не строится — pro-casa уже реализует модель «брокер ведёт продавца и объект в CRM», и у владельца квартиры нет и не будет отдельного аккаунта.

## Что уже есть в pro-casa (переиспользуем как есть)

- **`Seller`** — карточка продавца с воронкой `CONTACT → INTERVIEW → STRATEGY → CONTRACT_SIGNING`, поля `expectedPrice`, `minPrice`, `reason` (`SaleReason`), `deadline` (`SaleDeadline`) и т.д.
- **`CrmProperty`** — объект вторичного рынка: `city`, `district`, `residentialComplex`, `address`, `lat`/`lng`, `rooms`, `area`, `price`, `marketPrice`, `images`, `funnelStage` (`CREATED → PREPARATION → LEADS → …`), `publishedAt`, `casaUrl`.
- **`POST /api/public/forms/:id/submit`** (`public-forms.routes.ts`) — публичная (без авторизации) отправка лид-формы: создаёт `Seller` в `funnelStage=CONTACT`, назначает брокера (по явному `brokerId`, round-robin или fallback на админа), шлёт `Notification` брокеру. Дедуп по телефону. Сейчас все поля формы просто конкатенируются текстом в `managerComment` — структурированные поля `Seller` (`expectedPrice`, `reason`, `deadline`) не заполняются.
- **`property-calculator.service.ts`** — считает `PropertyClass`, `liquidityScore`/`liquidityLevel`, `recommendedStrategy` из технических характеристик объекта. **Не считает рыночную стоимость** — `marketPrice` там ручное поле брокера, не результат расчёта.

## Чего не хватает и что строим

### 1. Эндпоинт оценки — `POST /api/public/valuation`

Новый роут в `delivery/backend/src/routes/` (публичный, без авторизации, отдельный router `public-valuation.routes.ts`, монтируется в `src/index.ts` рядом с `publicFormsRouter`).

**Вход:** `{ city: "Алматы", district: string, rooms: number, area: number }`

**Логика:**
1. Найти `CrmProperty` (или `Property`, смотря где будет жить seed-набор — см. ниже) с `city = "Алматы"`, `district = input.district`, `rooms = input.rooms` (± при нехватке данных — без фильтра по комнатам, зафиксировать в коде явным шагом деградации, не тихим фолбэком).
2. Посчитать среднюю `price / area` (₸/м²) по найденным аналогам.
3. `marketValue = pricePerSqm * input.area`.
4. `urgentPrice = marketValue * 0.90`, `marketPrice = marketValue * 0.93` (коэффициенты как именованные константы в коде, не магические числа inline).

**Выход:** `{ marketValue, urgentPrice, marketPrice, comparablesCount }`.

Если аналогов 0 — возвращать понятную 404/422 с `{ error: "Недостаточно данных по этому району" }`, фронт показывает сценарий "не удалось оценить, оставьте заявку без цены" (мастер `/otsenka` уже это умеет — ветка "адрес не найден").

### 2. Ручной seed-набор объектов по Алматы

Т.к. в БД pro-casa сейчас нет ни одного объекта, для (а) сравнения в оценке и (б) карточек в каталоге на старте нужен набор реалистичных `CrmProperty` записей по районам Алматы (Алмалинский, Ауэзовский, Бостандыкский, Медеуский, Наурызбайский, Турксибский, Жетысуский, Алатауский), с `city="Алматы"`, `funnelStage="LEADS"`, `publishedAt=now()`, реалистичными `price`/`area`/`rooms`/`lat`/`lng`/`district`/`residentialComplex`.

Пользователь не предоставил реальный список — набор составляется как репрезентативные данные (типичные ЖК и ценовые диапазоны по районам Алматы), это явное допущение реализации, которое нужно будет заменить реальными данными позже.

Реализация: SQL-скрипт или `prisma` seed-функция в `delivery/backend/prisma/seed-almaty.ts` (не трогаем существующий `seed.sql`/`generate-seed.js` с пользователями), 20–30 записей.

### 3. Доработка `/otsenka` в casa

- `lib/mock/matchAddress` и `lib/mock/calculateValuation` заменяются на HTTP-вызовы к pro-casa backend (`POST /api/public/valuation`), география — районы Алматы вместо Астаны.
- Шаг с адресом теперь спрашивает район (dropdown, 8 районов Алматы) + ЖК/адрес текстом, а не пытается матчить точный адрес из моков — сценарий "адрес не найден" из текущего мастера удаляется за ненадобностью (район всегда выбирается явно).
- Финальный шаг (контакты) отправляет `POST /api/public/forms/:id/submit` на существующий лид-форм эндпоинт. Требуется доработка этого роута (обратная совместимость сохраняется): если `formData` содержит known-ключи (`expectedPrice`, `saleReason`, `saleDeadline`, `rooms`, `area`, `district`), писать их в соответствующие структурированные поля `Seller`/черновик `CrmProperty`, а не только в `managerComment`.
- Нужна фиксированная `LeadForm` запись в БД pro-casa для мастера оценки (`title: "Мастер оценки — Алматы"`), создаётся один раз (миграция/скрипт), её `id` зашивается в env casa (`OTSENKA_FORM_ID`).

### 4. Каталог для покупателя — `/catalog` и `/catalog/[id]`

- Новый публичный роут в pro-casa: `GET /api/public/properties?city=Алматы` — отдаёт список `CrmProperty` с `funnelStage="LEADS"` и `publishedAt IS NOT NULL` (т.е. уже промаркетированные брокером объекты), поля: `id, district, residentialComplex, address, lat, lng, rooms, area, price, images`.
- `GET /api/public/properties/:id` — детальная карточка, дополнительно отдаёт описание/характеристики, нужные для страницы объекта (этаж, этажность, ремонт, балкон и т.д. — подмножество полей `CrmProperty`, без внутренних CRM-полей типа `strategy`/`liquidityScore`/`trustLevel`).
- `/catalog` (casa): карта 2ГИС по `lat/lng` + список карточек, аналогично референсу casa.kz.
- `/catalog/[id]`: детальная страница + форма "Записаться на просмотр".
- **`POST /api/public/viewing-requests`** — новый лёгкий роут + модель `ViewingRequest` (`id, propertyId, name, phone, createdAt`) в `schema.prisma`. Без интерфейса просмотра на этом этапе (просто пишется в БД), это отдельная будущая задача.

### 5. Приём объявлений от владельца — `/prodat` + визард «Добавить квартиру»

- Публичная посадочная страница в casa (без авторизации), CTA "Добавить квартиру" → 4-шаговый визард (район/ЖК/адрес/дом → цена+торг → доп. параметры типа дома/этаж/ремонт/мебель/техника → фото).
- Сабмит → новый роут **`POST /api/public/property-leads`** в pro-casa: в одной транзакции создаёт `Seller` (`funnelStage=CONTACT`, `source="Форма: Добавить квартиру"`) + черновик `CrmProperty` (`funnelStage=CREATED`) с переданными техническими параметрами, назначение брокера — переиспользуем round-robin/fallback логику из `public-forms.routes.ts` (вынести в общую функцию `assignBroker()` в `src/lib/`, чтобы не дублировать).
- Фото — публичная загрузка без авторизации через существующий MinIO-адаптер (`file-storage.service.ts`), новый эндпоинт `POST /api/public/uploads` с ограничением по типу/размеру файла и rate-limit (публичный анонимный upload — must guard против абьюза: лимит на число файлов за запрос и на размер).

## Явно вне скоупа этого захода

- Личный кабинет продавца с авторизацией — не строится (см. решение выше).
- Интерфейс брокера/CRM для просмотра заявок на просмотр (`ViewingRequest`) — данные копятся в БД, UI будет отдельной задачей.
- Реальные, не seed, данные по Алматы — отдельная задача сбора/импорта данных.
- Изменения в мобильном/CRM-фронтенде `delivery/frontend` — не трогаем, кроме best-effort проверки, что новые публичные роуты не ломают существующие внутренние.

## Затрагиваемые файлы (ориентировочно)

**Backend (`delivery/backend`):**
- `src/routes/public-valuation.routes.ts` (новый)
- `src/routes/public-properties.routes.ts` (новый)
- `src/routes/public-property-leads.routes.ts` (новый)
- `src/routes/public-forms.routes.ts` (доработка: структурированный маппинг полей)
- `src/lib/lead-assignment.ts` (новый, вынесенная логика назначения брокера)
- `src/lib/valuation.service.ts` (новый, формула 0.90/0.93 + поиск аналогов)
- `prisma/schema.prisma` (добавить модель `ViewingRequest`)
- `prisma/migrations/` (новая миграция)
- `prisma/seed-almaty.ts` (новый, seed-набор объектов)
- `src/index.ts` (регистрация новых роутов)

**Frontend (`casa`, корень репозитория):**
- `lib/api/procasa-client.ts` (новый, HTTP-клиент к pro-casa backend)
- `app/otsenka/` — переделка под реальный API вместо `lib/mock`
- `app/catalog/`, `app/catalog/[id]/` (новые)
- `app/prodat/` (новый лендинг + визард "Добавить квартиру")
- `components/catalog/`, `components/property-wizard/` (новые)
- `lib/mock/` — удаляется после переключения `/otsenka` на реальный API

## Тестирование

- Backend: vitest unit-тесты на `valuation.service.ts` (расчёт по аналогам, коэффициенты, поведение при 0 аналогов) и на `lead-assignment.ts`.
- Frontend: vitest на компоненты визардов и каталога (как сейчас в `components/wizard/__tests__`), с мокнутым `procasa-client`.
- Ручная проверка в браузере всех новых экранов перед сдачей (как и раньше).
