# Раздел «Застройщики» (self-service intake) — дизайн

**Дата:** 2026-08-12
**Статус:** утверждён пользователем, в реализацию.

## Цель

Дать застройщикам (property developers) само­обслуживаемый контур: они регистрируются, после одобрения админом получают упрощённый кабинет и быстро выкладывают свои ЖК (дом + весь фонд квартир с планировками). Добавленные ЖК **мгновенно видны всей CRM** — брокерам и админу. Всё максимально автоматизировано.

## Ключевой факт архитектуры (переиспользуем, не строим заново)

Бэкенд-ядро уже есть:
- Роль `UserRole.DEVELOPER` существует.
- `Project.developerId` (FK → User) с проверкой владения на всех write-операциях `projects`/`apartments`/`buildings` (`requireRole('DEVELOPER','ADMIN')` + сверка `developerId`).
- `GET /api/projects` показывает **всем не-DEVELOPER ролям все ЖК** (каталог общий на платформу), а роли `DEVELOPER` — только свои (`projects.routes.ts:90-92`). ⇒ «сразу видно брокерам» уже работает бесплатно.
- `POST /api/apartments/bulk` и `POST /api/apartments/import` (JSON, уже понимает русские заголовки колонок) — массовый ввод фонда.
- Публикация на публичный сайт: `Project.isPublished`/`publishedAt` + `GET /api/public/projects` (только `isPublished:true`).
- Логин уже режет вход по `user.isActive` (`auth.routes.ts:32`).

Отсутствует **фронт-контур застройщика** и **онбординг** — это и есть работа.

## Решения пользователя

| Вопрос | Решение |
|---|---|
| Аккаунты | Саморегистрация застройщика + одобрение админом |
| Модерация ЖК | Сразу видно брокерам в CRM; публичный сайт — отдельным тумблером `isPublished` |
| Публичный сайт casa40 | **Вне скоупа** этой задачи (тумблер оставляем, витрину casa40 не трогаем) |
| Ввод фонда | Excel-шаблон **и** шахматка-конструктор |

Приняты по умолчанию (архитектурные):
- Профиль застройщика — **поля на `User`**, а не отдельная модель (раздел у админа = фильтр по роли).
- Пароль застройщик задаёт **сам при регистрации**; одобрение просто активирует. Генератора паролей и email-рассылки нет (почтовика в проекте нет) — уведомление об одобрении внутреннее (`Notification`).

## Модель данных (изменения)

`delivery/backend/prisma/schema.prisma`:

```prisma
enum UserStatus {
  ACTIVE
  PENDING
  REJECTED
}

model User {
  // ...существующие поля...
  status             UserStatus @default(ACTIVE)   // ACTIVE у всех существующих юзеров
  // Профиль компании-застройщика (заполняется только для роли DEVELOPER):
  companyName        String?
  bin                String?    // БИН/ИИН
  companyPhone       String?
  companyLogo        String?    // URL логотипа
  companyWebsite     String?
  companyDescription String?
}
```

Миграция аддитивная: новый enum + nullable-поля + `status` c дефолтом `ACTIVE`, поэтому существующие данные не затрагиваются. Пишется через `prisma migrate dev --name add_developer_onboarding --skip-seed`, на прод накатится автоматически при старте контейнера.

## Контур 1 — Онбординг застройщика

### Бэкенд
- `POST /api/auth/register-developer` (**public, без auth**): Zod-схема `{ companyName, bin, firstName, lastName, email, phone, password(min 6) }`. Создаёт `User { role: DEVELOPER, status: PENDING, isActive: false, password: bcrypt, companyName, bin, companyPhone: phone }`. Дубликат email → 409 «Пользователь с таким email уже существует». Возвращает `{ message }` (не логинит).
- **Логин** (`auth.routes.ts`): после поиска пользователя, до проверки `isActive`, добавить понятные сообщения:
  - `status === 'PENDING'` → 403 «Заявка застройщика на рассмотрении».
  - `status === 'REJECTED'` → 403 «Заявка отклонена».
  - существующая проверка `!isActive` остаётся страховкой.
- Новый роутер `developers.routes.ts`, mount `/api/admin/developers`, `authenticate` + `requireRole('ADMIN')`:
  - `GET /` — список застройщиков (`role: DEVELOPER`), фильтр `?status=`, с `_count.projects`.
  - `POST /:id/approve` — `status: ACTIVE, isActive: true` + `Notification` застройщику («Ваша заявка одобрена»).
  - `POST /:id/reject` — `status: REJECTED, isActive: false` + `Notification`.
- `PUT /api/auth/developer-profile` (auth, роль DEVELOPER): обновляет company-поля.

### Фронтенд
- Публичная страница `app/zastroishchikam/page.tsx` (+ ссылка в шапке/подвале лендинга): краткий блок «зачем» + форма регистрации → `POST /api/auth/register-developer` → экран «Заявка отправлена, ожидайте одобрения».
- Админ-страница `app/dashboard/admin/developers/page.tsx`: вкладки «Заявки» (pending → «Одобрить»/«Отклонить») и «Активные». Пункт в `adminMenuItem` сайдбара: «Застройщики» → `/dashboard/admin/developers`.

## Контур 2 — Кабинет застройщика (role-scoped UI)

- Сайдбар (`components/app-sidebar.tsx`): для роли `DEVELOPER` меню урезается до: **«Мои ЖК»** (`/dashboard/projects`), **«Добавить ЖК»** (`/dashboard/projects/new`), **«Профиль компании»** (`/dashboard/developer/profile`). Убрать `DEVELOPER` из «Сделки (CRM)», «Ипотека», sellers-«Клиенты».
- После логина `DEVELOPER` → редирект на `/dashboard/projects` (страница входа в дашборд).
- Страница `app/dashboard/developer/profile/page.tsx` — редактирование профиля компании (`PUT /api/auth/developer-profile`), загрузка логотипа.
- Списки/создание/редактирование ЖК и шахматка — **существующие страницы** `/dashboard/projects/*` (уже фильтруют «только свои», write только DEVELOPER/ADMIN). Дизайн-язык не меняем.

## Контур 3 — Быстрый ввод фонда

### Бэкенд (`apartments.routes.ts`)
- `GET /api/apartments/import-template` (auth) — генерит .xlsx (exceljs) с заголовками `Этаж | Номер | Комнат | Площадь | Цена | Корпус` и примером строки, отдаёт файлом.
- `POST /api/apartments/import-xlsx` (multer single `file`, `requireRole('DEVELOPER','ADMIN')`, сверка владения) — парсит .xlsx (exceljs) в массив строк и переиспользует ту же логику upsert, что и `/import` (вынести в общий helper `importApartments(projectId, rows)`).
- Существующий `POST /import` (JSON) и `POST /bulk` — без изменений.

### Фронтенд (`app/dashboard/projects/[id]/apartments/page.tsx`)
- Кнопки: «Скачать шаблон», «Загрузить Excel» (→ import-xlsx, тост с результатом created/skipped), «Сгенерировать дом».
- **Шахматка-конструктор** (диалог/секция): поля «этажей N», «квартир на этаже M», базовые параметры → генерит редактируемую сетку N×M → правки в ячейках → `POST /api/apartments/bulk`. Планировки грузятся через `/api/upload/single`.

## Контур 4 — Хранилище файлов (техдолг, блокирует интейк)

`upload.routes.ts`: `/upload/multiple` и `DELETE /upload/:fileName` завязаны на отключённый `minioClient!` и упадут. Переписать на локальный диск по образцу `/upload/single` (запись в `../../uploads/<category>`, URL `/uploads/...`). `presigned` — не используется интейком, оставить как есть либо вернуть 501.

## Границы скоупа

- **casa40 (публичный сайт) не трогаем.** Тумблер «Опубликовать на сайт» (`isPublished`) добавляем в форму ЖК (одна галочка, бэк готов), но витрину casa40 и её проверку в задачу не берём.
- Отдельной модели компании-застройщика с иерархией нет (YAGNI) — профиль на `User`.
- Email-уведомлений нет (нет почтовика) — только `Notification`.

## Обработка ошибок

- Регистрация: дубликат email → 409; невалидные поля → 400 (Zod).
- Логин застройщика на модерации/отклонён → 403 с понятным текстом.
- Импорт Excel: построчная валидация (как в `/import`), ответ `{ created, skipped, errors[] }` показывается тостом.
- Все write-эндпоинты уже под `requireRole` + сверкой владения — чужой проект/квартиру застройщик не тронет (проверяется в тестах).

## Тестирование

- Backend unit (vitest): register-developer (успех, дубликат), login-gate (PENDING/REJECTED → 403), approve/reject (смена status+isActive+Notification), import-xlsx (парсинг + upsert + отказ по чужому проекту), developer-profile update.
- Backend integration: полный путь регистрация → отказ логина (PENDING) → approve админом → успешный логин.
- Frontend: сборка + typecheck; smoke в браузере — регистрация, очередь модерации, вход застройщика, урезанное меню, создание ЖК, импорт Excel, шахматка-генератор.

## Порядок реализации

1. Схема + миграция.
2. Бэкенд онбординга (register/login-gate/developers routes/profile) + тесты.
3. Бэкенд интейка (import-template/import-xlsx + helper) + upload-fix + тесты.
4. Сайдбар (slim developer + admin item) + редирект.
5. Фронт: публичная регистрация, админ-модерация, профиль компании — параллельно.
6. Фронт: Excel + шахматка-конструктор.
7. Верификация (typecheck/tests/build + live smoke) → commit → push → деплой → проверка на проде → отчёт.
