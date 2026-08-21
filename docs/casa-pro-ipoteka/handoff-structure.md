# Карта блоков ипотечного модуля CASA Pro

Источники: извлечённые тексты финальных спецификаций (`.docx → .txt`) — 01 «Проверка по ИИН», 04 «Профиль клиента», 05 «Единый стандарт правил банков», 06 «Полезные механики», 07 «Продуктовая линейка Отбасы Банк» (обзорно, как пример реального bank-источника). Даты в документах — 21.08.2026, версии 1.0.

Документ описывает по каждому блоку: **Назначение · Входы · Выход по итогу · Ключевые правила/энумы/статусы · Legal/gates · Связь с рабочим экраном**. Формулировки удерживаются близко к первоисточнику; где документ молчит — помечено «нет в документе».

Сквозной инвариант всех блоков: **ФАКТ ≠ ИНТЕРПРЕТАЦИЯ CASA ≠ ПРАВИЛО БАНКА ≠ ВЕРДИКТ**. `UNKNOWN` / «Нет данных» никогда не превращается в `0`, `false`, `clean` или `accepted`.

---

## Блок 1. Проверка клиента по ИИН (IIN Check Engine)

**Назначение.** После ввода ИИН собрать только поисточниковые подтверждённые факты через официальный разрешённый канал (исполнительные производства, ограничение на выезд, налоговый статус и т. д.). Блок собирает факты и provenance, но НЕ выносит банковский вердикт: найденная запись — не запрет на ипотеку, отсутствие записи — не одобрение банка.

**Входы.**
- ИИН участника (12 цифр + контрольный 12-й разряд по офиц. правилам; из структуры ИИН нельзя выводить пол/дату).
- `borrower_id`, identity_version, tenant.
- Активное `consent` конкретного участника на цель `mortgage_preanalysis_official_registry_checks` (версия текста + manifest источников).
- Source registry по каждому источнику: `legal_basis_status=approved`, credentials, terms version, field allowlist, TTL, fallback.
- `Idempotency-Key`.

**Выход по итогу (главное).**
- Иммутабельный `client_check_batch` + набор `client_check_result` (один источник × check_type) + `client_check_fact` (source-backed, неизменяемый).
- **Coverage-based итог** (не общий зелёный статус): раздельно automatic completed/required и manual completed/required.
- **Итоговый статус batch** (один из): `COMPLETE_FACTS_FOUND` · `COMPLETE_NO_RECORDS` · `PARTIAL` · `BLOCKED_CONSENT` · `BLOCKED_LEGAL` · `STALE`.
- По каждому источнику: outcome, `checked_at`, `source_data_as_of`, `fresh_until`, provenance (source URL, request/response IDs, connector version, evidence hash), канал (API/ручной/клиент-авторизованный).
- Отдельный `client_risk_signal` (интерпретация CASA с rule_version) — НЕ bank rule/verdict.

**Ключевые правила/энумы/статусы.**
- `status`: `queued | running | completed | manual_required | consent_required | source_unavailable | stale | legal_unconfirmed | access_required | not_allowed | error`.
- `result.outcome`: `found | not_found | zero | not_applicable | unknown`. `not_found` — только по документированному upstream no-match (напр. `SCSE001` АИС ОИП); HTTP 404 КГД = «доступ запрещён», не «не найдено».
- `automation_mode`: `official_api | official_open_data_api | manual_official | client_authorized_document | approved_integration | prohibited`.
- Служебные статусы допуска: `MANUAL_CHECK_REQUIRED`, `CONTRACT_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, `NOT_ALLOWED`, `ACCESS_TOKEN_REQUIRED`, `CLIENT_AUTH_REQUIRED`.
- Manifest v1: `BASE_REQUIRED` (enforcement_proceedings, exit_restriction, executive_inscription, taxpayer_ip_status, tax_debt, bankruptcy_nonjudicial, bankruptcy_judicial_restoration); `IP_CONDITIONAL` (kgd_counterparty_profile, tax_reporting_suspension); `CASE_CONDITIONAL` (legal_entity_participation, property_rights, movable_pledge, license_status); `PROHIBITED` (court_acts_blanket_screening, credit_history_direct, enpf_direct, bank_data, closed_gov_data).
- Правило свежести (консервативная политика CASA, не офиц. срок): большинство проверок `fresh_until` = 24 ч; регистрация ИП/налогоплательщика, юрлица, лицензии = 7 дней. Хранить и `source_data_as_of`, и CASA-TTL.
- Пять разных состояний, которые нормализатор НЕ имеет права объединять: `Нет данных` / `null` / пустой массив / `0` / ошибка.
- Deny-by-default feature flag на каждый источник.

**Legal/gates.**
- Автоматические коннекторы MUST быть `enabled=false`, пока не закрыты юридические вопросы **J-01…J-09** (роли/DPA, текст согласия, коммерческое использование open data, КДП/eGov, API-доступ по токенам, банкротство full-list, локализация в KZ, retention, третьи лица) — даже при рабочем токене.
- `LEGAL_REVIEW_REQUIRED` — практически на всех источниках (АИС ОИП, КГД, ЕНИС и др.).
- `ACCESS_TOKEN_REQUIRED` — АИС ОИП (API key + terms), КГД (X-Portal-Token).
- `CONTRACT_REQUIRED` — прежде всего для прямого доступа к кредитным бюро.
- `CLIENT_AUTH_REQUIRED` — налоговая задолженность (eGov 2-часовое подтверждение), приостановление отчётности, юрлица, недвижимость, залог движимого имущества.
- `NOT_ALLOWED` (в v1): банк судебных актов blanket screening; и жёсткий запрет по одному ИИН — кредитная история/рейтинг, ЕНПФ, банковские счета/тайна, закрытые госданные, ЭЦП/пароли/OTP/session cookies, массовые списки граждан, неофициальные агрегаторы, обход CAPTCHA/headless.
- Релиз по этапам: R0 (модель/UI/manual — без внешних вызовов) → R1 (АИС ОИП после gate) → R2 (КГД после token+legal) → R3 (только manual: ЕНИС, tax debt, банкротство) → R4 (не выпускать: court/credit/ENPF/bank/closed/CAPTCHA-bypass).

**Связь с рабочим экраном.** Секция 2 «Документы и ИИН» (`runIinCheck`), состояния карточек источников: Проверено / Не найдено / Найдено / Требуется ручная проверка / Нужно согласие / Источник недоступен / Устарело / Юр. статус не подтверждён / Нужен доступ / Запрещено / Выполняется / Ошибка. Цвет — не единственный носитель смысла; disclaimer «Факт источника — не решение банка».

---

## Блок 4. Профиль клиента (Client Profile Engine)

**Назначение.** Анкета собирает только недостающие факты (участники/семья, цель покупки, занятость, доходы, активы, источник первоначального взноса, спец-факты), не переспрашивая то, что уже подтверждено блоками ИИН/Кредитная история/Пенсионные. Блок НЕ решает, какой доход принимает банк, и НЕ выдаёт ипотечный вердикт.

**Входы.**
- Published snapshots: `iin_check_snapshot`, `credit_history_snapshot`, `pension_snapshot` (по ID + quality/freshness, без перечитывания PDF).
- Ручные ответы клиента/риелтора + evidence.

**Выход по итогу (главное).**
- Иммутабельный `client_profile_snapshot` (`schema_version: casa.client_profile_snapshot/1.0.0`) — единый нейтральный вход для Bank Rules Engine: `participants[]`, `upstream{iin/credit/pension snapshot ids}`, `purchase_goal`, `household`, `employments[]`, `income_sources[]`, `assets[]`, `down_payment_sources[]`, `non_credit_commitments[]`, `quality{completeness, conflict_count, unknown_fields}`, `input_hashes`.
- Разделённые агрегаты взноса: `declared_down_payment_total`, `verified_down_payment_total`, `available_now_total`, `future_available_total`, `unverified_total`, `restricted_or_unavailable_total`. `source_acceptance_by_bank` — **не рассчитывается**.
- Нейтральные суммы дохода `total_declared_income` / `total_verified_income`. `accepted_income_by_bank` — **запрещён в этом блоке**.
- Completeness/конфликты, готовые к publish.

**Ключевые правила/энумы/статусы.**
- Источник поля: `IIN_CHECK | CREDIT_HISTORY | PENSION | USER_DECLARED | BROKER_ENTERED | DOCUMENT_VERIFIED | CASA_DERIVED`.
- `field_status`: `UNKNOWN | DECLARED | SOURCE_FACT | EVIDENCE_REQUESTED | VERIFIED | CONFLICT | STALE | NOT_APPLICABLE | CORRECTED`.
- `employment_type`: `EMPLOYEE | IP_BUSINESS | SELF_EMPLOYED | BUSINESS_OWNER | PUBLIC_SERVICE | MILITARY | NOT_EMPLOYED | OTHER`; `employment_status`: `CURRENT | PREVIOUS | PROBATION | LEAVE | MATERNITY_LEAVE | ENDED | UNVERIFIED`.
- `income_type`: `SALARY | BUSINESS | CONTRACT_FREELANCE | RENTAL | BENEFIT | PENSION | HOUSING_PAYMENT | ALIMONY_RECEIVED | DIVIDEND/INVESTMENT | OTHER`.
- `down_payment source_type`: `CASH_SAVINGS | BANK_DEPOSIT | OTBASY_SAVINGS | EPV_PENSION | HOUSING_CERTIFICATE | ASSET_SALE | GIFT | ADDITIONAL_COLLATERAL | OTHER`.
- `section_status`: `NOT_STARTED | IN_PROGRESS | COMPLETE_DECLARED | NEEDS_EVIDENCE | CONFLICT | BLOCKED | CONFIRMED | STALE`.
- Инварианты: Asset ≠ Down Payment (квартира 30 млн не равна взносу 30 млн); pension sender ≠ работодатель автоматически (только reviewed relation); конфликт → `CONFLICT/NEEDS_REVIEW`, победитель скрыто не выбирается; ручная правка не стирает source value (создаёт `CORRECTED` revision с actor/reason/time).
- Publish gates snapshot: `CPG-01…CPG-08` (primary borrower; upstream snapshots; goal; household; income owner/type/amount; down payment reconciled или UNRECONCILED; нет unresolved BLOCKING conflict; critical corrections с actor/reason/time).

**Legal/gates.**
- Release gates `RG-CP-01…RG-CP-07` — продуктовые/юридические, блокируют прод-сбор до утверждения: точный состав обязательных вопросов; purpose/consent на manual financial data и участников; evidence policy (что считается `VERIFIED`); enum registry + migration policy; freshness policy; какие `non_credit_commitment` реально нужны launch-банкам (минимизация); прогон CP-001…CP-035 + UX.
- Минимизация: не собирать полные данные родственников/иждивенцев «на всякий случай», не собирать универсальный «социальный профиль» заранее.

**Связь с рабочим экраном.** Секция 1 «Участники и согласие» (`openClientPicker`, `openConsent`, `revokeConsent`) + анкетные разделы (участники/цель/работа+доход/активы+взнос/обязательства/автоданные/подтверждение). Badges источника у каждого значения: Автоматически / Со слов клиента / Подтверждено документом / Нужно подтверждение / Конфликт / Устарело / Неизвестно. UX-правило: 6–8 коротких секций, не «анкета на 80 полей».

---

## Блок 5. Единый стандарт правил банков (Bank Rules Standard / Program Knowledge Base)

**Назначение.** НЕ единые условия для всех банков, а единый **язык и форма хранения** правил: каждый банк и программа описываются отдельно, версионно и детерминированно. Один `client_profile_snapshot` из блоков 1–4 остаётся неизменным; меняются только версионные правила программы. Так Halyk/BCC/Freedom/Forte/Отбасы и др. сравниваются одним движком без банковских догадок.

**Входы.**
- Иммутабельные snapshots блоков 1–4 (`iin_check.*`, `credit_history.*`, `pension.*`, `client_profile.*`) + `scenario.*` (what-if), `property.*` (будущий блок), `otbasy.*` (отдельный движок).
- Каждый input несёт quality envelope: `value/normalized_value`, `presence` (`PRESENT | EXPLICIT_ZERO | BLANK | UNKNOWN | NOT_APPLICABLE | UNREADABLE`), `verification` (`DECLARED | VERIFIED | REVIEWED | CONFLICT | STALE`), `as_of/checked_at`, `fresh_until`, `evidence_refs`, `snapshot_id+hash`.

**Выход по итогу (главное).**
- Иерархия `bank → mortgage_program → program_version → program_rule → rule_source` + отдельный `program_intake`.
- Детерминированный **verdict программы**: `ELIGIBLE | CONDITIONAL | INELIGIBLE | MANUAL | STALE | CONFLICT` + **explain trace** (input fact → rule → calculation/comparison → result → source).
- **Два независимых статуса**: `program_fit_status` и `intake_status` (`OPEN | QUEUE_ONLY | PAUSED | QUOTA_EXHAUSTED | SELECTED_PARTICIPANTS_ONLY | CLOSED | UNKNOWN`). «ELIGIBLE + CLOSED» = соответствует правилам, но сейчас недоступно.
- Каждый analysis хранит `snapshot_id/hash + program_version_id + engine_version` для воспроизводимости.

**Ключевые правила/энумы/статусы.**
- `rule_result` (атомарное): `PASS | FAIL | CONDITIONAL_PASS | UNKNOWN_INPUT | MANUAL_REQUIRED | STALE_SOURCE | CONFLICT | NOT_APPLICABLE`. Только `PASS` на fresh verified inputs даёт green.
- `rule_kind` (DSL): `COMPARATOR | RANGE | SET | DATE_WINDOW | FORMULA | TABLE | CONDITIONAL | AGGREGATION | REQUIREMENT | INFORMATIONAL | MANUAL`. Никакого LLM-prompt / «AI decides» внутри production-правила.
- Таксономия категорий правил: `PARTICIPANT_IDENTITY, HOUSEHOLD, EMPLOYMENT, INCOME_ACCEPTANCE, PENSION_REQUIREMENT, CREDIT_HISTORY_CURRENT, CREDIT_HISTORY_HISTORICAL, OBLIGATION_TREATMENT, AFFORDABILITY, DOWN_PAYMENT, CO_BORROWER, PROPERTY, LOAN_TERMS, SPECIAL_CATEGORY, OWNERSHIP_RESTRICTION, INTAKE, EVIDENCE_REQUIREMENT, MANUAL_BANK_POLICY`.
- Атомарность: один `rule_code` = одна мысль (нельзя «возраст 21–63, стаж 6 мес, взнос 20%» строкой — это 3 правила).
- Класс источника: `BANK_CONFIRMED | OFFICIAL_PUBLIC | REGULATORY | OFFICIAL_PROGRAM_OPERATOR` (могут давать green) vs `OBSERVED | SECONDARY | CONFLICT` (green запрещён; брокерская практика → MANUAL).
- Агрегирование: HARD FAIL → `INELIGIBLE`; CONFLICT → `CONFLICT`; STALE обязательного → `STALE`; MANUAL/UNKNOWN обязательного → `MANUAL`; исправимое conditional → `CONDITIONAL`; все PASS + fresh → `ELIGIBLE` (= «соответствует подтверждённым правилам CASA», не «одобрено банком»).
- Запрещённые shortcuts: `ОПВ/10% = принятый доход`; `monthly_payment из ПКО = банковский учёт обязательства`; суммирование всех заявленных доходов; регуляторная формула = внутренняя формула банка.
- TTL по умолчанию: intake/quota ≤24ч (очередь до 4ч); rates/fees/limits ≤3 дней или `effective_to`; eligibility ≤14 дней; developer/object list ≤24ч; inventory/price 15 мин feed.
- Версионность: published `program_version` иммутабелен; изменение rule → новый hash/новая версия; maker не может approve свою версию (four-eyes); regression до publish.
- Контрольные тесты стандарта: `BR-001…BR-050`.

**Legal/gates.**
- Release gates `BRG-01…BRG-09`: input contracts зафиксированы; Rule DSL компилируется/тестируется; source governance (registry/TTL/hash/conflict); maker-checker без self-approval; regression harness; explain trace; Otbasy adapter; first-bank gold validation живым mortgage-SME; launch set (для каждого launch-банка hard rules complete, unknown → manual, TTL active).
- Наполнение конкретных банков — только отдельными **Bank Research Packs** (шаблон A…O), не в этом блоке. Документ намеренно НЕ утверждает реальные условия ни одного банка.
- MUST NOT: хранить банк как hard-coded if/else без версии/источника; переносить правило одного банка на другой; считать отсутствие публичного правила доказательством допуска/отказа; превращать наблюдение брокера в green; редактировать опубликованную версию задним числом; использовать LLM как финальный decision; называть CASA preliminary verdict банковским одобрением.

**Связь с рабочим экраном.** Секция 3 «Анализ» (`runAnalysis`, `confirmSnapshot`) — вердикты программ с rule trace; секция 4 «Сценарии»; секция 6 «Подбор квартир» (property fit). В коде demo-движок отдаёт вердикты `not_eligible / potentially_eligible / manual_bank_confirmation_required / insufficient_data` с freshness `officially_verified / bank_confirmed / stale_requires_review / observed_requires_confirmation` — прямое зеркало этой модели.

---

## Ключевые механики (Блок 6 «Полезные механики»)

Практический справочник: адаптация книги «Как выгодно оформить ипотеку» к KZ, отделённая от российских норм и рискованных советов. Не нормативный документ; не заменяет юр-экспертизу или решение банка.

### Механика A. Ипотечное дело как центральная сущность
- **Назначение.** Строить модуль не как одноразовый калькулятор вероятности, а как рабочее пространство, где риелтор ведёт клиента от первого контакта до сделки и после.
- **Входы.** Цель, участники, финансы, доходы, обязательства, объект, документы, правила/расчёты, действия.
- **Выход по итогу.** Долговечная карточка дела, объединяющая факты блоков, но с сохранением происхождения каждого значения (источник + дата + версия; ручная правка не стирает исходное; расчёт хранит снимок входов; неизвестное не подменяется нулём).
- **Правила/статусы.** Этапы: Новый лид → Профиль собран → Данные подтверждаются → Сценарии рассчитаны → Правила сопоставлены → Объект проверяется → Пакет готов → Внешнее решение → Сделка/сопровождение. Статусы блоков: Готово / Нужны данные / Есть расхождение / Нужна проверка человека / Не применимо / Устарело.
- **Legal/gates.** Ни один статус CASA не должен означать гарантированное одобрение/выдачу/юр. чистоту.
- **Экран.** Весь единый экран `/dashboard/mortgage` (sticky-шапка готовности, резюме, проблемы→действия).

### Механика B. Динамический список данных и документов
- **Назначение.** Пакет документов не универсален — собирается из измерений (роль, занятость, банк/программа/версия, тип объекта, продавец, семейный контекст, источник взноса, выявленное расхождение) с объяснением, почему каждый элемент появился.
- **Выход.** Карточка требования: наименование/цель, основание, владелец, критичность (обязательный/условный/рекомендованный), срок актуальности, формат/источник, статус (`не запрошен / запрошен / получен / проверяется / принят / отклонён / устарел`), причина отклонения. + контроль качества документа (полнота/читаемость/актуальность/согласованность/происхождение/ручная проверка).
- **Экран.** Секция 2 (документы), раздел «Документы» карточки дела.

### Механика C. Сценарный калькулятор и what-if
- **Назначение.** Готовить понятные варианты (не угадывать решение банка): менять взнос, срок, стоимость, состав участников, программу, объект без потери исходной версии.
- **Входы.** Стоимость объекта, взнос (сумма/доля/источник), сумма займа, срок, ставка, ГЭСВ, схема погашения, дата выдачи, страхование/оценка/комиссии, подтверждённые доходы/обязательства, методика нагрузки, ограничения программы.
- **Выход.** Ежемесячный платёж, полная стоимость, ГЭСВ, LTV, кредитная нагрузка (с версией правила), остаточный доход, стресс-сценарий, статус ограничений. Оригинал неизменен; каждый вариант — своя версия; клиентская версия без внутренних оценок.
- **Полезные сценарии.** Увеличить взнос; снизить стоимость/сумму; сравнить сроки без подмены ставки; закрыть дорогое обязательство; добавить созаёмщика/доход; сменить объект/программу; досрочное погашение (срок vs платёж); точка безубыточности рефинансирования.
- **Экран.** Секция 5 «Что если» (`changeWhatIf`, `saveWhatIfScenario`).

### Механика D. Каталог рекомендаций (следующий шаг)
- **Назначение.** Рекомендация = конкретное проверяемое следующее действие с причиной, эффектом, подтверждениями, ответственным и ограничением применимости.
- **Выход.** Типы: `DATA_FIX, DOCUMENT_FIX, DEBT_REDUCTION, REFINANCE, PARTIAL_PREPAYMENT, INCOME_CONFIRMATION, CO_BORROWER, DOWN_PAYMENT, TERM, PROPERTY_CHANGE, PROGRAM_CHANGE, WAIT_UPDATE, HUMAN_REVIEW`.
- **Экран.** Секция 7 «Заключение» (`saveNextAction`), блок «Проблемы и действия».

### Механика E. Проверка объекта недвижимости (независимая ось)
- **Назначение.** Финансовая готовность клиента и пригодность объекта — две независимые оси. Объект проверяется отдельно; для новостроек — конкретный ЖК/очередь, разрешение/гарантия, дата проверки; аккредитация банка ≠ законность привлечения средств (разные факты).
- **Legal/gates (красная граница).** CASA не показывает объект «юридически чистым» только потому, что он подходит финансово или есть в рекламном списке — нужен официальный источник и, при необходимости, проверка специалиста. Российские ДДУ/эскроу/ЕГРН заменяются KZ-источниками.
- **Экран.** Секция 6 «Подбор квартир» (`matchProperties`, `toggleSelection`); в demo — статусы fit `fits_now / fits_after_selected_scenario / accreditation_check_required / does_not_fit`.

### Механика F. Экспорт, клиентская версия и аудит
- **Назначение.** Внутренний отчёт (полный) + клиентская версия (простым языком, без внутренних риск-ярлыков, лишних PII и обещаний одобрения).
- **Legal/gates.** Клиентский экспорт маскирует чувствительные данные; разъяснение «расчёты предварительные, решение — за банком».
- **Экран.** Секция 7 «Заключение» (`generateLink`, `generatePdf`), публичные страницы `/consent/[token]` и `/z/[token]`.

### Приоритеты внедрения (из блока 6)
`P0` основа (дело, участники, этапы, происхождение данных, динамические требования, задачи, аудит) → `P1` решение специалиста (кредитная история, доходы/ЕНПФ, Bank Rules Engine, сценарии, рекомендации) → `P2` объект и пакет → `P3` расширение (заявки, решения, сделки, комиссии, досрочное/рефинансирование).

---

## Блок 7. Продуктовая линейка Отбасы Банк (обзорно, для контекста)

Это не спецификация блока CASA, а **реальный первичный bank-источник** — «Продуктовая линейка АО "Отбасы Банк"» (утв. 10.04.2018, ред. по 16.07.2026, ~130 версий изменений). Служит эталонным примером того, что Bank Research Pack (блок 5) должен извлечь и разложить на атомарные версионные правила.

**Что в нём есть (для понимания объёма).**
- Вклад ЖСС: тарифные программы «Баспана» (2% годовых), «Табысты» (5,5%), депозит «АРНАУ» (для несовершеннолетних, 2%, мин. срок 10 лет). Договорная сумма мин. 500 МРП, макс. совокупно 200 млн ₸.
- Формулы: ежемесячный взнос `ЕВ = ДС × К` (коэффициент по сроку накопления 3–15 лет), `ЕВ = max{ЕВ1, ЕВ2}` при наличии накоплений; оценочный показатель для очередности.
- Операции: изменение договорной суммы, объединение, уступка возмездная/безвозмездная (условия по родству, МРП-порогам), деление вкладов.
- Множество госпрограмм: «Бақытты отбасы», «Жас отбасы», «Наурыз», «Отау», «Асыл Мекен», «Зелёная ипотека», «Умай», региональные «…жастары», военная «Жаңа баспана» и т. д. — каждая со своей ставкой, суммой, взносом, датой ввода.

**Вывод для модуля.** Именно такой массив (ставки/суммы/взносы/даты/условия по десяткам программ и ~130 редакций) обосновывает требование блока 5: банк нельзя держать в коде, только как версионные атомарные правила с source/effective/TTL. Отбасы дополнительно требует **отдельный Otbasy Engine** (депозит, ОП, госпремия, переходы жилищный/промежуточный/предварительный) — общая аннуитетная формула к нему неприменима (тест `BR-045`).

---

## Карта модуля: как блоки соединяются в один поток

### Сквозной поток одного ипотечного дела

```
Согласие клиента (Consent)
      │  purpose + manifest источников; отзыв/истечение блокируют всё ниже
      ▼
Блок 1 — Проверка по ИИН ──► iin_check_snapshot (факты + coverage, без вердикта)
      │
      ├─ (параллельно) Кредитная история PDF ──► credit_history_snapshot   [блок 2, вне этих 5 файлов]
      ├─ (параллельно) ЕНПФ / доходы PDF ─────► pension_snapshot           [блок 3, вне этих 5 файлов]
      ▼
Блок 4 — Профиль клиента (спросить только недостающее)
      │  объединяет 3 snapshot + ручные ответы; ловит конфликты
      ▼
      client_profile_snapshot  (иммутабельный, нейтральный; accepted_income — НЕТ)
      ▼
Блок 5 — Bank Rules Standard  (один snapshot × N program_version)
      │  атомарные детерминированные правила + source/TTL/maker-checker
      ▼
      verdict по программе: ELIGIBLE/CONDITIONAL/INELIGIBLE/MANUAL/STALE/CONFLICT
      + intake_status (отдельно)  + explain trace
      ▼
Сценарии (what-if) ──► Подбор объектов (property fit, независимая ось)
      ▼
Заключение: внутренний отчёт  +  безопасная клиентская версия (маскирование PII)
      ▼
[P3, отдельные контуры] Заявка → Решение банка → Сделка → После выдачи
```

Ключевые «стыки» (контракты между блоками):
- Каждый downstream-блок читает только **published immutable snapshots** (ID + hash + quality/freshness), не перечитывая исходные PDF/ответы. Изменение источника → новый snapshot → новый analysis; старый analysis воспроизводится по прежним ID/hash.
- Отзыв согласия останавливает весь поток вниз.
- Отбасы уходит в отдельный Otbasy Engine, но возвращает совместимый trace-формат.

### Что из этого уже есть в коде (demo-режим, без миграций)

Каталог `delivery/frontend` + `delivery/backend`; всё помечено demo_only, реальные SMS/PII/ИИН/персистентность за флагами.

- **Единый рабочий экран** `/dashboard/mortgage` (`app/dashboard/mortgage/page.tsx` + `components/mortgage/workspace/*`) — 7 секций, зеркалящих поток: (1) Клиент и согласие, (2) Документы и ИИН, (3) Анализ, (4) Сценарии, (5) Что если, (6) Подбор квартир, (7) Заключение. Контракт действий — `workspace/contracts.ts` (`WorkspaceHandlers`).
- **Demo-движок** `backend/src/lib/mortgage-workspace/engine.ts`: `computeWhatIf` (аннуитет + КДН + демо-связь КДН→число программ), `demoAnalysis` (4 программы с вердиктами/freshness/rule-trace — зеркало модели блока 5), `demoScenarios` (6 сценариев с score breakdown — зеркало механики C/D), `demoProperties` (4 ЖК с fit-статусами — механика E), `buildConclusionPayload` (безопасное клиентское заключение без ИИН — механика F).
- **Публичные страницы**: `/consent/[token]` (согласие клиента) и `/z/[token]` (заключение) + backend `public-mortgage.routes.ts`.
- **API**: `mortgage-workspace.routes.ts`, `public-mortgage.routes.ts`; also `mortgage.routes.ts`, `mortgage-programs.routes.ts`, `mortgage-applications.routes.ts`, `mortgage-financial.service.ts` (Decimal-safe примитивы `annuityPayment`, `kdnAfter`).
- **Инструменты** `/dashboard/mortgage/tools`.

То есть в коде живёт **демонстрационный контур единого экрана и оркестрации** (структура секций, what-if пересчёт, показ вердиктов/сценариев/квартир/заключения на моке) — это реализация «рабочего пространства» механики A и UI-слоёв блоков 1/4/5.

### Что новое (спроектировано в этих спеках, но не в коде / за gates)

- **Блок 1 (ИИН) production-контур**: сущности `client_check_batch/result/fact`, `manual_check_task`, `client_risk_signal`; source registry с legal/access/terms/allowlist/TTL; deny-by-default коннекторы (АИС ОИП, КГД); coverage-логика и 6 статусов batch; API `/api/v2/…/iin-check-batches`. Всё за J-01…J-09 и R1–R4.
- **Блок 4 (профиль) production-контур**: сущности `client_profile`, `profile_field_revision`, `household`, `co_borrower_relation`, `non_credit_commitment`, `purchase_goal`, `client_profile_snapshot`; unified field status/conflict engine; publish gates CPG-01…08; API `/api/v2/cases/{id}/client-profile*`. Новые относительно текущего ТЗ: `purchase_goal`, `non_credit_commitment`, `profile_field_revision`, разделение взноса на деньги vs additional collateral, reviewed-relation pension↔employment.
- **Блок 5 (правила банков) production-контур**: Program Knowledge Base (`bank/mortgage_program/program_version/program_rule/rule_source/program_intake/source_check`); Rule DSL; source governance с maker-checker и hash/TTL; агрегатор в 6 вердиктов + отдельный intake; explain trace с replay; API `/api/v2/banks|program-versions|program-rules|rule-sources|program-intakes|analyses`. Наполнение — через Bank Research Packs (начиная с одного gold-банка, напр. Отбасы из блока 7).
- **Отдельные блоки вне этих файлов**: Кредитная история Engine (блок 2), Пенсионный Engine (блок 3), Property block, Otbasy Engine, контуры Заявка/Решение/Сделка (P3).

### Итоговая граница

Текущий код = **демо единого экрана и оркестрации на моках**. Спецификации 01/04/05 = **production-контракты трёх ядровых блоков**, которые пока закрыты юридическими (J-01…J-09), доступными (токены/договоры) и maker-checker/regression gates. Механики (06) — продуктовые паттерны, уже частично отражённые в demo-секциях; продуктовая линейка (07) — образец наполнения для Bank Rules Standard.

---

## Приложение: «выход по итогу» одной строкой

| Блок | Главный выход по итогу |
|---|---|
| 1. Проверка по ИИН | Иммутабельный `client_check_batch` + поисточниковые `client_check_result/fact` с coverage-статусом (`COMPLETE_FACTS_FOUND / COMPLETE_NO_RECORDS / PARTIAL / BLOCKED_CONSENT / BLOCKED_LEGAL / STALE`) — факты + provenance, без банковского вердикта. |
| 4. Профиль клиента | Иммутабельный нейтральный `client_profile_snapshot` (участники/цель/занятость/доходы/активы/взнос/обязательства + quality) как единый вход Bank Rules Engine; без `accepted_income_by_bank`. |
| 5. Правила банков | Детерминированный verdict программы `ELIGIBLE/CONDITIONAL/INELIGIBLE/MANUAL/STALE/CONFLICT` + отдельный `intake_status` + воспроизводимый explain trace (snapshot_id/hash + program_version_id). |
| Механика A (дело) | Долговечная карточка дела с этапами и происхождением каждого значения — оркестрация без непрозрачного единого балла. |
| Механика B (документы) | Динамический список требований (карточка требования со статусом и основанием) под конкретный контекст. |
| Механика C (what-if) | Сравнимые версии сценариев с платежом/LTV/КДН/остаточным доходом; оригинал неизменен. |
| Механика D (рекомендации) | Конкретное следующее действие (тип из каталога) с причиной, эффектом и ответственным. |
| Механика E (объект) | Независимый fit-статус объекта; юр. чистота — только по официальному источнику, не по финансовому соответствию. |
| Механика F (экспорт) | Внутренний отчёт + безопасная клиентская версия с маскированием PII и disclaimer «решение за банком». |
| 7. Отбасы (контекст) | Образец реального bank-источника (десятки программ, ~130 редакций) → обоснование версионных атомарных правил и отдельного Otbasy Engine. |
