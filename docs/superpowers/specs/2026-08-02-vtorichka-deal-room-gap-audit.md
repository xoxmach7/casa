# Гэп-аудит: «Вторичка» / Deal Room v2.0 vs текущая схема

**Источник требований:** `CASA_Developer_Handoff_v2.0` (Product Master v1.1 + System/Valuation/Showings/Deal Room/Data-API-Security/Release-QA specs), полученный от CEO 2026-08-02.
**Цель документа:** этап 0 из `06_CASA_Release_QA_Plan_v2.0` — карта «сохранить / исправить / создать / скрыть» перед началом реализации Foundation → Valuation → Showings → Deal Room.

Схема на момент аудита: `delivery/backend/prisma/schema.prisma`, 94 модели/enum'а, актуальный HEAD `27628f1`.

## Итог одним абзацем

Бэкенд уже реализует значительную часть продукта (Client/Seller/Buyer/CrmProperty/Show/Offer/Deal/Commission/Fixation/Selection/MortgageProgram/ClientScoring), но это более ранняя, менее строгая версия модели (v1.1-эпохи, без AuditLog, без версионирования, без канонического стейт-машина Deal Room). Главный риск: существующий `Deal`/`DealStage`/`DealAgentAction` — это **живая фича брокерского Kanban с ИИ-агентом**, а не черновик под Deal Room. Его нельзя переиспользовать напрямую под новый стейт-машин (`offer_submitted → ... → sold|failed` с Green-гейтами) — это два разных домена, которые в v2.0-документе разделены явно (Property Fixation/Booking/Deal остаются про новостройки и брокерскую комиссию; Deal Room — новый контур строго для вторички). Решение: **новые модели для Deal Room**, а не расширение `Deal`.

## Карта по доменам

| Домен (canonical) | Каноническая сущность | Существующий аналог | Решение | Комментарий |
|---|---|---|---|---|
| Identity | User, Organization, Role, Permission | `User` + `UserRole` enum | **FIX** | Нет multi-org, нет гранулярных Permission — но пилот single-tenant, можно отложить Organization/Permission до после пилота, если явно не потребуется. |
| Identity | AuditLog | — отсутствует | **CREATE** | Критический блокер: почти все acceptance criteria в v2.0-пакете требуют AuditLog. Наивысший приоритет Foundation. |
| Identity | ConfigVersion (версионируемые справочники/коэффициенты) | `SystemSettings` (плоский) | **FIX** | Нужна версионированная модель с `effective_from/effective_to` для коэффициентов оценки, порогов ипотеки, тарифов. |
| Вторичка | OwnerLead / SellerSubmission | `Seller` + `SellerFunnelStage` (CONTACT/INTERVIEW/STRATEGY/CONTRACT_SIGNING/CANCELLED) | **CREATE** | Статусы не совпадают с каноническими (new/contact_in_progress/qualified/needs_information/accepted/rejected/converted_to_object/archived). Нужна отдельная лёгкая сущность intake-этапа **до** превращения в полноценного `Seller`. |
| Вторичка | SecondaryProperty | `CrmProperty` (богатая, ближе к спеке) **и** legacy `Property` (простая, старая, используется в `properties.routes.ts`/`clients.routes.ts`) | **KEEP `CrmProperty`, HIDE `Property`** | Два параллельных объекта одного домена — ровно тот конфликт, о котором предупреждает раздел 06. `Property` старше (первый коммит репозитория), `CrmProperty` ближе к канонической карточке (раздел 5.2). Нужен план миграции данных `Property → CrmProperty` перед скрытием. |
| Вторичка | PropertyMedia (версионируемый, с FileAsset) | `CrmProperty.photos`/`images` инлайн-массив (нужно доп. проверить точные поля) | **FIX/CREATE** | Инлайн-массив не даёт версии, модерации по каждому файлу и связи с FileAsset/malware-scan — нужна отдельная таблица. |
| Вторичка | Viewing (полный канонический стейт-машин) | `Show` + `ShowStatus` (только SCHEDULED/COMPLETED/CANCELLED) | **FIX** | Не хватает draft/requested/awaiting_seller_confirmation/reschedule_requested/no_show_buyer/no_show_seller/expired и полей confirmation_source/confirmed_by/version. |
| Вторичка | (публичный вход с CASA.kz) | `ViewingRequest` (анонимно, name+phone+property) | **KEEP** | Соответствует публичному пути CASA.kz → в дальнейшем должен создавать OwnerLead/ClientPropertyInterest, а не Show напрямую. |
| Вторичка | Offer (offer/counteroffer/price_agreed) | `Offer` (PENDING/ACCEPTED/REJECTED) | **FIX** | Нет counteroffer-цепочки и гарантии «ровно один активный Deal на property+buyer» (уникальность из раздела 05). |
| Клиент | Client | `Client` | **KEEP** | Достаточно богатый, соответствует разделу 7.1. |
| Клиент | ClientConsent (версионированное согласие) | Разрозненные поля согласия в формах (`LeadForm`, `consent_version` в контракте) — отдельной таблицы нет | **CREATE** | Нужно как отдельная версионируемая сущность — используется и в Seller-форме, и в ипотечном Pre-Score (раздел 9.2). |
| Клиент | ClientPropertyInterest | Косвенно через `Buyer`+`Show`, нет явной сущности «интерес без ещё запланированного показа» | **CREATE** | Нужна как промежуточный шаг между лидом и Viewing (см. канонический путь в 01_System_Master). |
| Клиент | Shortlist / ShortlistItem | `Selection` + `SelectionApartment` | **FIX** | Статусы (`draft/shared/viewed/client_selected/closed`) совпадают 1:1 с каноном — отлично. Но сейчас подборка **только для новостроек** (комментарий в схеме: «не для вторичного рынка») — нужно расширить на `CrmProperty`. |
| Сделка | DeveloperFixation | `Fixation` + `FixationStatus` | **KEEP** | Статусы совпадают почти дословно с разделом 8.2 канона. Ничего менять не нужно. |
| Сделка | Booking (новостройка, после Fixation) | `Booking` (привязан к `Apartment`, статус `BookingStatus`) | **KEEP** | Это другой Booking, чем `DealBooking` из Deal Room — не путать, оставить как есть для контура новостроек. |
| Сделка | **Deal Room** (offer_submitted → ... → sold\|failed, Green 1/2, DealDeposit, DealBooking, DealMortgage, DealPrecheck, DealRisk, DealTask, DealEvent) | `Deal` + `DealStage` (CONSULTATION-стиль Kanban) + `DealAgentAction` (ИИ-агент） + `Commission` | **CREATE новые модели, не трогать `Deal`** | `Deal`/`DealAgentAction` — рабочая фича брокерского Kanban (коммит `02e51ea` AI deal-watcher). Смешивать с новым строгим Deal Room стейт-машином нельзя: разные бизнес-правила, разные роли (Coordinator vs broker), разные гарантии (idempotency, Green-гейты, coordinator_verification). Предлагается: `SecondaryDeal` (или `DealRoom`) + `DealPrecheck`/`DealDocument`/`DealDeposit`/`DealBooking`/`DealMortgage`/`DealRisk`/`DealTask`/`DealEvent` как новые модели, отдельные от `Deal`. `Commission` можно переиспользовать (статусы уже 1:1 совпадают с разделом 10 канона — estimated→expected→confirmed→invoiced→received→payable_to_partner→paid→disputed→cancelled). |
| Ипотека | Bank | Отсутствует как отдельная модель (банк — вероятно строка в `MortgageProgram`) | **CREATE** | Нужен справочник банков отдельно от программ. |
| Ипотека | MortgageProgram | `MortgageProgram` | **FIX** | Нужно версионирование (`MortgageRuleVersion`) и явная связь с Bank. |
| Ипотека | MortgageCase / FinancialDocument / ExtractedField / PreScoreResult / Recommendation | `MortgageApplication`, `MortgageCalculation`, `ClientScoring`, `ClientDocument` | **FIX** | Смысл близкий, но нет по-полевого хранения `original_value/confirmed_value/confidence/document/page` (раздел 9.3 канона) и версионирования результата Pre-Score при повторном расчёте. |
| Платформа | Course/Lesson/Test | `Course`, `CourseTest`, `TestAttempt`, `CourseProgress` | **KEEP** (Lesson, вероятно, инлайн — уточнить при разработке модуля обучения) | Не в приоритете для Вторички/Deal Room. |
| Платформа | Notification | `Notification` + `NotificationType` | **KEEP** | Соответствует. |
| Платформа | FileAsset (закрытое хранилище, подписанные ссылки) | `file-storage.service.ts` + `minio.ts` (есть сервис, нет универсальной модели FileAsset) | **FIX** | Нужна единая модель `FileAsset` с owner/scope, чтобы `PropertyMedia`/`DealDocument`/`ClientDocument` ссылались на неё одинаково, а не хранили url-строки по отдельности. |

## Приоритет реализации (следует порядку из `06_CASA_Release_QA_Plan_v2.0`)

1. **Foundation** — `AuditLog`, `ConfigVersion`, `FileAsset` (без них ни один acceptance criteria из пакета не проходит).
2. **Valuation** — новый модуль `Valuation`/`ValuationVersion`/`Comparable`/`MarketReference`, привязанный к `CrmProperty`. Это по сути замена/расширение существующего mock otsenka-wizard на публичном сайте (там сейчас чистый mock без реального человека-ревьюера) — тоже конфликт старого/нового, требует отдельного решения при разработке модуля.
3. **Showings** — `FIX Show/ShowStatus` до канонического стейт-машина, `CREATE ClientPropertyInterest`.
4. **Deal Room** — новые модели, не трогая `Deal`.
5. **Pilot hardening** — уже частично закрыто прошлыми сессиями (healthcheck, CVE patching, IDOR-фиксы — см. `project_security_audit_2026_07_30` и `project_devops_audit_2026_08_01` в памяти) — переиспользовать эту работу, не переделывать.

## Открытые вопросы к CEO/владельцу решений (не блокируют Foundation, но блокируют Deal Room)

- Юридический текст договора задатка и судьба задатка при отказе (раздел 11 `04_CASA_Deal_Room_Spec`) — явно отмечено как production blocker, требует профильной проверки.
- План миграции данных `Property → CrmProperty` (кто ещё использует legacy `Property` в проде — нужно проверить перед HIDE).
- Юридическая модель эскроу денег: документ прямо запрещает приём денег CASA в Release 1 — нужно подтвердить, что это по-прежнему так, до проектирования `DealDeposit`.
