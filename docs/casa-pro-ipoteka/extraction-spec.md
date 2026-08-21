# CASA Pro Ипотека — Спецификация извлечения полей (Credit History + ЕНПФ)

> Источники: `handoff-txt/02_credit_history.txt` (CASA PRO — Credit History Engine, v1.0, 21.08.2026)
> и `handoff-txt/03_pension.txt` (CASA PRO — Pension Contribution Engine, v1.0, 21.08.2026).
> Документ дословно верен исходным ТЗ. Где исходник оставляет вопрос открытым — это помечено `UNKNOWN` / `OPEN` / соответствующим gate.
>
> Общие инварианты обоих движков:
> - **Три несмешиваемых уровня данных:** `SOURCE_FACT` (факт из PDF/бюро/эмитента), `CASA_DERIVED` (детерминированный расчёт движка со ссылкой на input IDs и версию формулы), `BANK_RULE` (будущий Bank Rules Engine — здесь не считается).
> - Уровень 2 никогда не перезаписывает уровень 1. Уровень 3 получает отдельный snapshot и не меняет факты/расчёты.
> - `SOURCE_FACT` immutable; исправление создаёт **новую reviewed revision**, а не переписывает raw.
> - `UNKNOWN` **никогда** не заменяется нулём. Пустая ячейка не превращается в `0.00`.
> - Каждое критическое поле хранится как envelope: `{raw_value, normalized_value, presence, confidence, page, bbox, extractor, validation_status, review_status, evidence_id}`.
> - Presence-домен (общий): `PRESENT`, `EXPLICIT_ZERO`, `BLANK`, `NOT_APPLICABLE`, `UNREADABLE`, `UNKNOWN` (у кредитного движка дополнительно `NOT_IN_TEMPLATE`). Только `PRESENT` и `EXPLICIT_ZERO` участвуют в арифметике без отдельного решения.

---

## ЧАСТЬ 1. КРЕДИТНАЯ ИСТОРИЯ (ПКБ/ГКБ) — Credit History Engine

Бюро в РК: **ПКБ = FCB** (Первое кредитное бюро), **ГКБ = SCB** (Государственное кредитное бюро).
Regression-fixture: полный персональный кредитный отчёт ПКБ, 29 страниц, сформирован 08.08.2026 09:51:38 (Asia/Almaty — `ASSUMED`), A4 landscape, PDF 1.7, PDFium, не зашифрован, есть текстовый слой, криптоподписи нет.

Каждое поле каждого договора имеет: `raw_value, normalized_value, presence, page, bbox, extractor, confidence, validation_status, review_status, evidence_id`. Ниже колонка «Обяз.» и «Critical» относятся к semantics ТЗ; «Уровень» — SOURCE_FACT, если не указано иное.

### 1.1. Поля шапки отчёта (`credit_report_document` / header)

| field_key | Подпись (рус.) | Тип | Как опознаётся / маркеры | presence-обработка | Обяз. | Critical | Уровень |
|---|---|---|---|---|---|---|---|
| `bureau` | Бюро | enum+raw | Issuer markers в шапке/футере; enum `FCB`/`SCB`/`UNKNOWN` | present/unknown | Да | Да (сверяется вручную) | SOURCE_FACT |
| `report_kind` | Тип отчёта | enum+raw | Заголовок «Полный персональный кредитный отчёт» → `FULL_PERSONAL`; иначе `personal`/`partial`/`unknown` | present/unknown | Да | Да | SOURCE_FACT |
| `report_id` | Номер отчёта | string | Печатается в шапке; не выдумывать, если нет | present/blank | Если напечатан | Да | SOURCE_FACT |
| `report_generated_at` | Дата/время формирования | datetime | Титул отчёта; хранить с `report_time_zone_status` = `EXPLICIT`/`ASSUMED`/`UNKNOWN` | present | Да (для snapshot) | Да | SOURCE_FACT |
| `subject_name_raw` | ФИО субъекта | string | Раздел данных субъекта; в UI маскируется, exact — в защищённом хранилище | present | Да | Да | SOURCE_FACT |
| `subject_identifier_masked` | Идентификатор (маск.) | string | Не выводить полный ИИН в UI/log | present/blank | Если есть | Да | SOURCE_FACT |
| `report_pages_declared` | Страниц (по footer) | integer | Из footer/header (`N/29`) | present | Да | Да | SOURCE_FACT |
| `report_pages_actual` | Страниц (по PDF) | integer | Из PDF parser | present | Да | Да | SOURCE_FACT |
| `language_codes` | Языки | array | `ru`, `kk`, `en` | present | Да | Нет | SOURCE_FACT |
| `bureau_rating` | ПКР (рейтинг бюро) | object | Блок рейтинга: `value` / `raw class` / `as_of` / `model label`. В fixture: 636, класс, `as_of` 08.07.2024 — старше отчёта | present/blank | Нет | Нет | SOURCE_FACT |
| `summary_facts` | Итоги «как напечатано» | array | Итоговые строки отчёта; не заменяют CASA-профили | present/blank | Нет | Нет | SOURCE_FACT |
| `report_time_zone_status` | Статус часового пояса | enum | `EXPLICIT`/`ASSUMED`/`UNKNOWN`; `UNKNOWN`/`ASSUMED`, если PDF не печатает зону (OQ-10) | — | Да | Нет | SOURCE_FACT |

### 1.2. Поля каждого договора / source contract record (`credit_report_contract_record`)

Каждый напечатанный блок «КОНТРАКТ N» → отдельный immutable record, даже если позже объединяется в lineage. Никогда не удаляется после dedup (можно пометить `NOT_A_CONTRACT_RECORD` после review).

#### A. Происхождение и идентификаторы

| field_key | Подпись | Тип | Маркеры / опознание | presence | Critical | Уровень |
|---|---|---|---|---|---|---|
| `section` | Раздел | enum | Из page map: `ACTIVE`/`CLOSED`/`CLOSED_OVER_FIVE_YEARS`/`RECALLED`/`UNKNOWN` | — | Да | SOURCE_FACT |
| `source_ordinal` | Порядковый № записи | integer | 1-based reading order после page map | — | Да | SOURCE_FACT |
| `page_start`, `page_end` | Стр. начала/конца | integer | Геометрия; договор не резать по границе страницы | — | Нет | SOURCE_FACT |
| `record_hash` | Хэш записи | sha256 | Full field tuple | — | Да | CASA_DERIVED |
| `creditor_name_raw` / `_normalized` | Кредитор (raw/норм.) | string | Заголовок блока | present/unknown | Да | SOURCE_FACT |
| `creditor_bin` | БИН кредитора | string | Маскируется в UI | present/blank | Нет | SOURCE_FACT |
| `creditor_type_raw` / `creditor_type` | Тип кредитора | enum+raw | `BANK`/`MFO`/`CREDIT_PARTNERSHIP`/`PAWNSHOP`/`COLLECTOR`/`RETAILER`/`TELECOM_OR_UTILITY`/`GOVERNMENT`/`OTHER`/`UNKNOWN` | present/unknown | Да | SOURCE_FACT |
| `contract_code` | Код договора | string | Ключевой dedup-ключ; сохранять leading zero (напр. `1705551`) | present/blank | Да | SOURCE_FACT |
| `agreement_number` | Номер договора | string | Отдельно от кода | present/blank | Нет | SOURCE_FACT |
| `application_date` | Дата заявки | date | — | present/blank | Нет | SOURCE_FACT |
| `contract_start_date` | Дата начала | date | Часть strong source key | present/blank | Да | SOURCE_FACT |
| `contract_end_date` | Дата окончания | date | — | present/blank | Нет | SOURCE_FACT |
| `actual_issue_date` | Факт. дата выдачи | date | — | present/blank | Нет | SOURCE_FACT |
| `actual_close_date` | Факт. дата закрытия | date | В fixture у коллектора 10.03.2023 | present/blank | Да | SOURCE_FACT |
| `record_as_of` | Актуальность записи | date | Свежесть строки внутри свежего ПКО; blank ≠ самая новая дата | present/blank | Да | SOURCE_FACT |
| `bureau_received_at` | Дата получения бюро | date | Хранить отдельно от `report_generated_at` | present/blank | Да | SOURCE_FACT |
| `balance_as_of` | Актуальность баланса | date | — | present/blank | Да | SOURCE_FACT |
| `delinquency_as_of` | Актуальность просрочки | date | База для `current_dpd` | present/blank | Да | SOURCE_FACT |
| `assignee_name` | Цессионарий | string | Раздел уступки | present/blank | Да | SOURCE_FACT |
| `assignee_bin` | БИН цессионария | string | — | present/blank | Нет | SOURCE_FACT |
| `assignment_date` | Дата уступки | date | — | present/blank | Да | SOURCE_FACT |
| `assignment_amount` | Сумма уступки | money | — | present/blank | Нет | SOURCE_FACT |
| `assignment_price` | Цена уступки | money | — | present/blank | Нет | SOURCE_FACT |
| `related_contract_refs[]` | Связанные договоры | array | Таблица related contracts; основа lineage | present/blank | Да | SOURCE_FACT |

#### B. Классификация

| field_key | Подпись | Тип | Маркеры / enum | presence | Critical | Уровень |
|---|---|---|---|---|---|---|
| `financing_type_raw` | Тип финансирования (raw) | string | — | present | Нет | SOURCE_FACT |
| `product_type` | Продукт | enum | `LOAN`/`MICROLOAN`/`CREDIT_CARD`/`CREDIT_LINE`/`INSTALLMENT`/`MORTGAGE`/`OVERDRAFT`/`GUARANTEE`/`SURETY`/`OTHER`/`UNKNOWN`; неизвестный label → `UNKNOWN` (не nearest) | present/unknown | Да | SOURCE_FACT |
| `credit_purpose_raw` | Цель кредита (raw) | string | — | present/blank | Нет | SOURCE_FACT |
| `credit_object_raw` | Объект кредита (raw) | string | — | present/blank | Нет | SOURCE_FACT |
| `funding_source_raw` | Источник финансирования | string | — | present/blank | Нет | SOURCE_FACT |
| `subject_role_raw` / `subject_role` | Роль субъекта | enum+raw | `BORROWER`/`CO_BORROWER`/`JOINT_BORROWER`/`GUARANTOR`/`SURETY_PROVIDER`/`PLEDGOR`/`OTHER`/`UNKNOWN` | present/unknown | Да | SOURCE_FACT |
| `joint_liability_flag` | Совместная ответственность | bool | Хранится отдельно; не выводить из названия роли | present | Да | SOURCE_FACT |
| `guarantee_flag` | Флаг гарантии | bool | Факт поручительства ≠ нулевой долг | present | Да | SOURCE_FACT |
| `pledger_flag` | Флаг залогодателя | bool | — | present | Нет | SOURCE_FACT |
| `phase_raw` / `phase` | Фаза | enum+raw | `ACTIVE`/`CLOSED`/`CLOSED_EARLY`/`ASSIGNED_OUT`/`RECALLED`/`UNKNOWN` | present/unknown | Да | SOURCE_FACT |
| `source_status_raw` | Статус (raw) | string | Печатный статус строки | present | Да | SOURCE_FACT |
| `source_classification_raw` | Классификация (raw) | string | — | present/blank | Нет | SOURCE_FACT |
| `closure_kind` | Тип закрытия | enum | — | present/na | Нет | SOURCE_FACT |
| `dispute_flag` | Флаг оспаривания | bool | — | present | Нет | SOURCE_FACT |
| `restructured_flag` | Реструктуризация | bool | Событие, не фаза | present | Да (если есть) | SOURCE_FACT |
| `refinanced_flag` | Рефинансирование | bool | Событие | present | Да (если есть) | SOURCE_FACT |
| `prolongation_count` | Кол-во пролонгаций | integer | — | present/blank | Нет | SOURCE_FACT |
| `assigned_flag` | Флаг уступки | bool | — | present | Да | SOURCE_FACT |
| `recalled_flag` | Флаг отзыва | bool | — | present | Нет | SOURCE_FACT |
| `rehabilitation_status_raw` | Статус «Реабилитирован» (raw) | string | Присваивает бюро; CASA переносит raw+дату, не пересчитывает | present/blank | Да (если есть) | SOURCE_FACT |
| `rehabilitation_date` | Дата реабилитации | date | — | present/blank | Да (если есть) | SOURCE_FACT |

#### C. Суммы и платежи (`credit_report_balance_component`, ключ `type+as_of+currency`)

Инвариант денег: `decimal(20,2)` или точнее; никаких binary float; сумма без currency невалидна; пустая ячейка ≠ `0.00`. Валюты не суммируются между собой — карта по ISO currency.

| field_key | Подпись | Тип | Семантика / что НЕ путать | presence | Critical | Уровень |
|---|---|---|---|---|---|---|
| `currency` | Валюта | string(ISO 4217) | Не суммировать разные валюты | present/unknown | Да | SOURCE_FACT |
| `original_principal` | Первоначальная сумма | money | НЕ current debt | present/blank | Да | SOURCE_FACT |
| `credit_limit` | Лимит карты/линии | money | НЕ равен использованному и НЕ остатку | present/blank | Да | SOURCE_FACT |
| `utilized_amount` | Использованная сумма | money | Использование карты/линии | present/blank | Да | SOURCE_FACT |
| `outstanding_total_reported` | Итоговый остаток (из summary) | money | Итог строки summary, если есть | present/blank | Да | SOURCE_FACT |
| `current_principal_not_due` | Непросроч. осн. долг | money | — | present/blank | Да | SOURCE_FACT |
| `current_interest_not_due` | Непросроч. вознаграждение | money | — | present/blank | Да | SOURCE_FACT |
| `current_principal_overdue` | Просроч. осн. долг | money | Часть current overdue | present/blank | Да | SOURCE_FACT |
| `current_interest_overdue` | Просроч. вознаграждение | money | Часть current overdue | present/blank | Да | SOURCE_FACT |
| `current_penalty` | Текущая неустойка/штраф/пеня | money | Часть current overdue | present/blank | Да | SOURCE_FACT |
| `written_off_principal/_interest/_penalty` | Списано (осн./вознагр./пеня) | money | Отдельно от прощения и current balance | present/blank | Да (если есть) | SOURCE_FACT |
| `forgiven_principal/_interest/_penalty` | Прощено (осн./вознагр./пеня) | money | НЕ синоним «закрыто» | present/blank | Да (если есть) | SOURCE_FACT |
| `periodic_payment_reported` | Периодический платёж | money | Из ПКО; периодичность хранится отдельно | present/blank | Да | SOURCE_FACT |
| `minimum_payment_reported` | Мин. платёж карты | money | НЕ CASA/bank estimate | present/blank | Да | SOURCE_FACT |
| `payment_frequency_raw` / `payment_frequency` | Периодичность платежа | enum+raw | `monthly`/`weekly`/`at_maturity`/`irregular`/`unknown` | present/unknown | Нет | SOURCE_FACT |
| `nominal_rate` | Номинальная ставка | decimal | Факт; не нужен для current total, но хранится | present/blank | Нет | SOURCE_FACT |
| `effective_rate` | Эффективная ставка (ГЭСВ) | decimal | Факт; хранится | present/blank | Нет | SOURCE_FACT |

#### D. Просрочки и платёжная дисциплина (`credit_report_delinquency_observation`, `observation_kind` обязателен)

| field_key | Подпись | Тип | Семантика / запрет | presence | Critical | Уровень |
|---|---|---|---|---|---|---|
| `current_dpd` | Текущий DPD | integer≥0 | DPD на `delinquency_as_of`; **НЕ** lifetime max; минус/прочерк ≠ 0 | present/blank | Да | SOURCE_FACT |
| `current_overdue_installment` | Текущий просроч. взнос | money | Из шапки записи | present/blank | Да | SOURCE_FACT |
| `max_dpd_lifetime_reported` | Макс. DPD за всё время | integer≥0 | Напечатан бюро; в fixture 1919 | present/blank | Да | SOURCE_FACT |
| `max_overdue_amount_lifetime_reported` | Макс. просроч. сумма (истор.) | money | НЕ current debt | present/blank | Да | SOURCE_FACT |
| `max_dpd_as_of` | Дата актуальности максимума | date | Если есть | present/blank | Нет | SOURCE_FACT |
| `monthly_delinquency_observations[]` | Помесячная дисциплина (24 мес.) | array | Каждый элемент: `year/month, dpd, overdue_amount, penalty, presence, page/evidence` | present/blank | Да | SOURCE_FACT |
| `bureau_summary_delinquency_class` | Класс просрочки из summary | enum+raw | Напр. «30+ дней»; **НЕ** CASA threshold; сохранять сноску | present/blank | Нет | SOURCE_FACT |

#### E. Обеспечение и связанные лица (маскируются в UI)

| field_key | Подпись | Структура |
|---|---|---|
| `collateral[]` | Обеспечение | `type raw/normalized, value, valuation type, location masked, source page` |
| `related_subjects[]` | Связанные лица | `role raw/normalized, masked name/identifier, joint obligation flag, source page` |
| `guarantees[]` | Гарантии/поручительства | `guarantee/surety kind, beneficiary/creditor, amount if printed, start/end/status` |

#### F. Заявки на кредит (`credit_application` / `credit_application_event`)

Поля: `source_application_id, source_event_id, source_row_ordinal, applicant role, lender name/BIN/type, requested product, amount, currency, term, application timestamp/date, source outcome raw/normalized (created/under_review/approved/withdrawn/declined_by_lender/cancelled/unknown), outcome date/reason (если напечатано), linked contract code (только если явно), page/bbox/evidence`.
Правило: события с разными `source_application_id` не объединяются из-за совпадения кредитор+сумма+дата. Цепочка `created → declined` одной заявки — одна заявка с двумя событиями при явной связи.

#### G. Запросы кредитной истории (`credit_history_inquiry`)

Поля: `inquiry_id (CASA), source_row_ordinal, source unique key, requester name/BIN/type, report type raw/normalized, inquiry date/time, date precision (отдельно), inquiry_purpose, inquiry_class (CREDITOR/SELF_REPORT/GOVERNMENT_SERVICE/OTHER/UNKNOWN), page/bbox/evidence`.
Класс `SELF_REPORT` определяется по типу «Персональный/Полный персональный кредитный отчёт», **не** по названию запросившего. Неизвестный тип ≠ creditor inquiry по умолчанию.

#### H. Госсведения внутри ПКО (`credit_report_embedded_external_fact`)

Коды/статусы из госсистем (стр. 2 fixture) хранятся с `source code, raw status, датой получения бюро, ссылкой на страницу`. **Не** входят в current/historical debt metrics; **не** заменяют блок №1 (ИИН/реестры); маркируются «факт внутри ПКО на дату»; не запускают ипотечную интерпретацию.

---

## ЧАСТЬ 2. Канонические выходы кредитного движка

Расчёты детерминированы, версионированы, воспроизводимы. Вход — reviewed source facts + dedup graph конкретного snapshot. `UNKNOWN` не заменяется нулём. Окна считаются от `report_generated_at`: `[report_at − N дней, report_at]` (полузакрытое, cutoff включается).

### 2.1. `current_debt_profile` (CASA_DERIVED)

| Поле | Формула/семантика |
|---|---|
| `as_of` | report timestamp; отдельно min/max `record_as_of` |
| `active_obligation_count` | Canonical ACTIVE lineages роли borrower/co-borrower; гарантии отдельно |
| `active_source_record_count` | Active source rows до dedup |
| `total_outstanding_by_currency` | Один validated current outstanding на lineage; predecessors исключены |
| `total_reported_payment_by_currency` | Source periodic/min payments current lineages; вид платежа сохраняется |
| `current_overdue_amount_by_currency` | Current overdue компоненты current lineages |
| `active_current_delinquency_count` | Active canonical lineages с current DPD>0 |
| `max_current_dpd` | Max current DPD активных; НЕ lifetime |
| `active_card_count` | Active `CREDIT_CARD` lineages |
| `card_limits_by_currency` | Лимиты; НЕ outstanding |
| `card_utilized_by_currency` | Использовано/остаток по картам |
| `active_mfo_count` | Active canonical lineages типа MFO |
| `active_guarantee_count` | Active guarantee/surety facts; ≠ платёж |
| `unknown_current_amount_count` | Active lineages без установимой суммы |
| `stale_active_record_count` | Active records с `record_as_of` старше process threshold (не bank rule) |
| `reconciliation_status` | `PASS`/`PASS_WITH_REVIEW`/`FAIL`/`UNKNOWN` |

### 2.2. `historical_credit_profile` (CASA_DERIVED)

| Поле | Семантика |
|---|---|
| `source_contract_record_count` | Все contract blocks |
| `canonical_obligation_count` | Lineages после dedup |
| `closed_canonical_obligation_count` | Lineages с closed current node |
| `older_than_five_year_source_record_count` | Строки раздела «более 5 лет»; не обрезать |
| `max_dpd_lifetime` | Max validated lifetime DPD по lineages |
| `canonical_lineages_with_historical_dpd_count` | Lineages с lifetime DPD>0 |
| `source_records_with_historical_dpd_count` | Source rows с lifetime DPD>0 |
| `monthly_delinquency_observation_count` | Months с explicit DPD>0 |
| `estimated_delinquency_episode_count` | По §просрочки или `UNKNOWN` |
| `mfo_source_contract_record_count` | Source records типа MFO |
| `mfo_canonical_obligation_count` | MFO lineages после dedup |
| `collector_lineage_count` | Lineages с collector node |
| `assignment_event_count` | Explicit assignment events |
| `restructuring_event_count` | Explicit restructuring facts |
| `write_off_lineage_count` | Lineages с explicit write-off |
| `forgiveness_lineage_count` | Lineages с explicit forgiveness |
| `rehabilitated_lineage_count` | Source-reported rehabilitation |
| `application_count_30d/90d` | Unique source applications в окне; outcomes отдельно |
| `inquiry_count_30d/90d/180d` | Все inquiry rows в окне |
| `creditor_inquiry_count_*` | Только CREDITOR |
| `self_inquiry_count_*` | Только SELF_REPORT |
| `bureau_rating_fact` | value/class/as_of из ПКО; НЕ CASA metric |

### 2.3. Reconciliation-проверки (`credit_report_reconciliation_check`, REC-001…015)

Все critical checks должны быть `PASS`/`WAIVED` (с reason) до verified snapshot. Точность денег — exact до печатной minor unit; молчаливая tolerance запрещена (допускается только template-specific `PASS_WITH_ROUNDING`).

| Код | Проверка | Критичность |
|---|---|---|
| REC-001 | Actual pages = declared; footer sequence непрерывен | Blocking |
| REC-002 | Обязательные секции шаблона присутствуют | Blocking |
| REC-003 | Число source contract blocks по секциям воспроизводимо | Blocking |
| REC-004 | Summary active/closed классы сопоставлены с records (с учётом сноски) | Review; blocking для snapshot totals |
| REC-005 | Σ active outstanding по source rows = printed active total | Blocking для current balance |
| REC-006 | Σ active reported payments = printed active payment total | Blocking для payment total |
| REC-007 | Σ current overdue компонент совместима с header overdue | Blocking если active |
| REC-008 | Для closed record explicit balance 0 не конфликтует с header | Review |
| REC-009 | Source rows ≥ canonical lineages; каждое снижение объяснено merge links | Blocking |
| REC-010 | Все active source rows имеют ровно один current lineage | Blocking |
| REC-011 | Число applications в секции = число parsed application IDs | Review; blocking historical profile |
| REC-012 | Все inquiry rows учтены; 30/90/180 пересчитаны | Blocking для inquiry metrics |
| REC-013 | ПКР value/class/as_of извлечены из одного rating block | Review |
| REC-014 | Все related-contract rows ссылаются на source record/lineage | Blocking для dedup |
| REC-015 | Embedded state facts не вошли в debt metrics | Blocking (инвариант) |

Метрика возвращает `{status:"UNKNOWN", reason_code:...}` вместо числа при: неизвестной валюте, неразрешённом current node, пропущенной странице/секции, несошедшейся critical reconciliation, неразрешённом blank active amount/payment, subject mismatch, authenticity FAILED или неподтверждённой critical manual correction.

---

## ЧАСТЬ 3. Дедупликация и lineage

Дедупликация **не удаляет** записи ПКО — связывает source records, описывающие одну экономическую линию (`credit_obligation_lineage`). Ключевое разделение сущностей (исправление опасного пробела v2.0):

- **`credit_report_contract_record` (contract_record)** — один напечатанный блок договора; immutable; никогда не удаляется после dedup.
- **`credit_obligation_lineage` (obligation_lineage)** — каноническая экономическая линия долга; **текущий долг считается здесь**, не по source rows.
- **`credit_obligation_record_link` (record_link)** — решение merge/split: `decision (MERGE/KEEP_SEPARATE/SPLIT/PENDING), rule_code/version, evidence_ids[], compared keys, chain direction, technical confidence, decided_by/at, reason, supersedes_link_id, before/after membership hashes`. Обратимо, версионно, аудируемо.

### 3.1. Уровни совпадения

| Уровень | Условие | Действие |
|---|---|---|
| A. Exact record duplicate | Один version, record hash/page/block; parser создал 2 копии | Убрать parser duplicate, сохранить warning |
| B. Deterministic lineage | Явная таблица related contracts/assignment + matching IDs | Auto-link с reason/evidence/version |
| C. Strong candidate | Совпадают subject, exact code/number, origin creditor/date/amount + phase/assignee evidence | `MANUAL_REVIEW`; auto-link только после калибровки |
| D. Fuzzy similarity | Одинаковые кредитор/сумма/дата/тип без explicit IDs | НЕ merge; можно показать candidate |

### 3.2. Ключи и правила

- **Strong source key:** `bureau + subject + contract_code/agreement_number + creditor_bin + contract_start_date`. Пропущенную часть не додумывать.
- Между разными кредиторами exact code недостаточен — нужен explicit assignment/related-contract/assignee fact или manual confirmation.
- **Карты** с общим префиксом и разными суффиксами (fixture: `-001` и `-003`) **не merge**. Хранятся отдельно: `limit`, `utilized/outstanding`, `minimum_payment_reported`.
- Facility и child drawdowns — отдельно с `parent_facility_id`; неясная агрегация → `MANUAL_REVIEW` + блок current total.
- Новый договор при реструктуризации/рефинансировании не merge без explicit link; при связи — два legal contracts = два узла одного lineage.
- Заявки/запросы не merge по схожим полям; решают source IDs/строки.

### 3.3. Уступка/коллектор (fixture-кейс код `1705551`)

Код напечатан дважды: (1) исходный кредитор в разделе «более 5 лет» с фактом уступки и historical max DPD 337; (2) коллекторская запись с нулевым остатком, датой закрытия 10.03.2023, max DPD 1919, связанными договорами и статусом «Реабилитирован».
Ожидание: **два `contract_record`, один `obligation_lineage`, два узла цепочки**. Текущий остаток lineage = 0. Исторические суммы и DPD сохраняются как факты, но **не** прибавляются к current debt.

### 3.4. Выбор current node

1. Отбросить records не этого subject/lineage.
2. Сравнить `record_as_of`; blank не становится самой новой датой.
3. Учесть направление цепочки assignor → assignee/collector; assigned-out predecessor не current.
4. Если latest node CLOSED и explicit balance 0 → current balance lineage = 0.
5. Два latest active nodes с противоречием → `AMBIGUOUS_CURRENT_NODE`; aggregate не публикуется.
6. Historical DPD lineage = max validated nodes; все source values сохраняются.

---

## ЧАСТЬ 4. Просрочки (DPD) — current vs lifetime

Несмешиваемые факты:

| Факт | Определение | Нельзя |
|---|---|---|
| `current_dpd` | DPD на `delinquency_as_of` в current node | Заменять lifetime max |
| `current_overdue_amount` | Current overdue principal+interest+явная неустойка (версионная формула) | Прибавлять historical max overdue |
| `max_dpd_lifetime` | Max validated lifetime facts в lineage | Считать текущим |
| `monthly_observation` | DPD/сумма за календарный месяц | Придумывать exact start/end day |
| `bureau_summary_30_plus` | Класс из summary ПКО по его сноске | Превращать в универсальную оценку |

**Эпизоды (`delinquency_episode_estimate`, строится только из последовательных месячных observations):**
- Новый эпизод — в месяце DPD>0 после месяца с explicit DPD=0.
- Соседние месяцы DPD>0 — один estimated episode.
- Пустой/нечитаемый месяц не разрывает и не склеивает эпизод → результат `UNKNOWN`.
- Exact start/end day не выводится; метрика маркируется `estimated_from_monthly_table`.

Термин «количество исторических просрочек» без единицы запрещён. Движок возвращает раздельно: `source_records_with_historical_dpd_count`, `canonical_lineages_with_historical_dpd_count`, `monthly_delinquency_observation_count`, `estimated_delinquency_episode_count` (или `UNKNOWN`).

Примеры разделения: active record с current DPD 0 но lifetime 60 → только historical; closed collector с current 0 и lifetime 1919 → не в current; old assigned-out с DPD 337 → historical, не суммируется с collector balance; «Реабилитирован» не удаляет историю DPD.

---

## ЧАСТЬ 5. ЕНПФ (Pension Contribution Engine)

Regression-fixture `OPV_GOVCORP_KZ_2026_08_08_V1`: PDF 1.4, 191 258 bytes, SHA-256 `407e9a07…548d76`, 2 страницы (rotation 90°), госуслуга «о поступлении и движении средств вкладчика ЕНПФ» №61674534, период шапки 08.02.2026–08.08.2026, получен 08.08.2026 09:56:29, 6 строк (периоды 01.2026–06.2026), каждая 10 000,00 KZT, отправитель ИП RSHATOVA (один 12-значный ID), КНП 010, получатель НАО ГК «Правительство для граждан», все строки «ОБРАБОТАННЫЕ».

Три «нельзя менять» решения ТЗ: (A) период шапки ≠ доказанное покрытие; (B) в PDF нет напечатанного итога кол-ва/суммы; (C) устаревшая правовая ссылка в футере (Закон №370-II 2003 → утратил силу с Цифровым кодексом №255-VIII).

### 5.1. Поля строки взноса (`contribution_record`)

Даты — ISO 8601; деньги — Decimal string + ISO currency; месяц — `YYYY-MM`. Каждое critical-поле — envelope `{raw_value, normalized_value, presence, confidence, review_status, evidence}`.

| field_key | Подпись | Тип | Как опознаётся / правило | presence | Critical | Уровень |
|---|---|---|---|---|---|---|
| `record_id` | ID строки | string | Immutable | — | Да | CASA_DERIVED (ID) |
| `document_version_id` / `parse_run_id` | Provenance | string | Exact источник | — | Да | CASA_DERIVED |
| `source_row_index` | № строки | integer | 1-based reading order после page map | — | Да | SOURCE_FACT |
| `contribution_type` | Тип взноса | enum | Из КНП registry: `OPV/OPPV/OPVR/DPV/PENALTY_OPV/PENALTY_OPPV/PENALTY_OPVR/UNKNOWN`. **UNKNOWN не становится OPV по названию документа** | present/unknown | Да | SOURCE_FACT |
| `payment_code` | КНП | FieldValue\<string\> | 3 цифры, leading zero обязателен; string-parser, integer-конверсия запрещена | present | Да | SOURCE_FACT |
| `payment_class` | Класс платежа | enum | `CONTRIBUTION`/`PENALTY`/`UNKNOWN` | present/unknown | Да | SOURCE_FACT |
| `contribution_period` | Период взноса | FieldValue\<month\> | Raw `MMYYYY` → `YYYY-MM` после валидации месяца 01–12 (напр. `032026`→`2026-03`; `132026`→`NEEDS_REVIEW`); **никогда не период шапки** | present | Да | SOURCE_FACT |
| `received_date` | Дата поступления | FieldValue\<date\> | Фактическое поступление | present | Да | SOURCE_FACT |
| `sent_date` | Дата отправки | FieldValue\<date\> | Distinct от received | present | Да | SOURCE_FACT |
| `source_document_number` | Номер документа/транзакции | FieldValue\<string\> | dedup-ключ строки | present/blank | Нет | SOURCE_FACT |
| `document_date` | Дата документа/платежа в строке | FieldValue\<date\> | — | present | Да | SOURCE_FACT |
| `sender_name` | Отправитель (имя) | FieldValue\<string\> | Display only; exact raw | present | Да | SOURCE_FACT |
| `sender_identifier` | ID отправителя | FieldValue\<string\> | 12 цифр в fixture; не приводить к числу | present | Да | SOURCE_FACT |
| `sender_type_if_known` | Тип отправителя | enum | `IP/LEGAL_ENTITY/PHYSICAL_PERSON/PLATFORM/UNKNOWN`; префикс «ИП» не доказывает связь с субъектом/занятость | present/unknown | Нет | SOURCE_FACT |
| `sender_role` | Роль отправителя | const | `CONTRIBUTION_SENDER`; **НЕ EMPLOYER** | present | Да | SOURCE_FACT |
| `recipient_name` | Получатель | FieldValue\<string\> | Печатный получатель | present | Да | SOURCE_FACT |
| `recipient_identifier` | ID получателя | FieldValue\<string\> | Только если напечатан/registry mapping | present/blank | Нет | SOURCE_FACT |
| `amount` | Сумма | FieldValue\<Money\> | Decimal string; explicit zero отличается от blank | present/explicit_zero/blank | Да | SOURCE_FACT |
| `currency` | Валюта | string | `KZT` когда напечатан/доказан шаблоном; иначе `UNKNOWN` | present/unknown | Да | SOURCE_FACT |

### 5.2. Строка — качество/эффект/evidence

| field_key | Подпись | Тип | Правило | Critical |
|---|---|---|---|---|
| `source_status_raw` | Статус (raw) | string | Напечатанное значение | Да |
| `source_status` | Статус (норм.) | enum | `PROCESSED`/`RETURNED`/`REVERSED`/`REJECTED`/`UNKNOWN` | Да |
| `processing_effect` | Эффект | enum | `EFFECTIVE`/`EXCLUDED`/`UNKNOWN` | Да |
| `direction` | Направление | enum | `CREDIT`/`DEBIT`/`UNKNOWN`; не выводить из знака без rule | Нет |
| `row_fingerprint` | Отпечаток строки | sha256 | Full reviewed field tuple | Да |
| `duplicate_status` | Статус дубля | enum | `UNIQUE`/`EXTRACTION_DUPLICATE`/`CANDIDATE`/`CONFIRMED` | Да |
| `duplicate_of_record_id` | Дубль записи | string? | Только deterministic/reviewer | Нет |
| `correction_or_return_reference` | Ссылка на оригинал | string? | Если источник доказывает | Нет |
| `source_page` | Страница | integer | 1…page_count | Да |
| `source_bbox` | BBox | BBox | Normalized x/y/w/h + rotation | Да |
| `evidence_id` | Evidence | string | Encrypted crop/text span + hash | Да |
| `critical_field_status` | Статус critical-полей | enum | `PASS`/`NEEDS_REVIEW`/`FAILED` | Да |
| `row_review_status` | Статус ревью строки | enum | `EXTRACTED`/`NEEDS_REVIEW`/`ACCEPTED`/`CORRECTED`/`REJECTED` | Да |
| `reviewer_decision_id` | Решение ревьюера | string? | reason+actor+timestamp+before/after hash | Нет |
| `registry_versions` | Версии реестров | object | template/KNP/status/rate dictionaries | Да |

### 5.3. Поля шапки документа ЕНПФ (header, SOURCE_FACT)

| field_key | Подпись | Тип | Правило |
|---|---|---|---|
| `issuer` | Эмитент | string | `GOVCORP_KZ` в fixture |
| `document_type` | Тип документа | string | `ENPF_MOVEMENT_REPORT` |
| `template_id` | Шаблон | string | `GOVCORP_ENPF_MOVEMENT_RU_KK_2026` |
| `document_number` | Номер документа | string | `61674534` в fixture |
| `report_query_period_start/end` | Период запроса шапки | date range | 08.02.2026–08.08.2026; **хранить отдельно от покрытия** |
| `query_period_basis` | Базис периода запроса | enum | `RECEIVED_DATE`/`CONTRIBUTION_PERIOD`/`UNKNOWN`; **fixture = UNKNOWN** (семантика поля не найдена, OQ-01/RG-01) |
| `received_at` | Дата получения | datetime | 08.08.2026 09:56:29 (+05:00 по контексту) |
| `page_count` | Кол-во страниц | integer | 2 |
| `subject IIN/ФИО` | Субъект | string | exact match с participant; в spec маскировано |
| `age_days` | Возраст (дней) | integer | CASA_DERIVED |
| `freshness_status` | Свежесть | enum | `CURRENT`/`STALE`/`UNKNOWN` (versioned TTL, предлагаемый дефолт 30 дней — RG-07) |

### 5.4. Помесячный bucket (`contribution_month`, CASA_DERIVED)

Два независимых измерения: `coverage_status` (может ли документ доказать отсутствие строки) и `contribution_status` (итог месяца).

| Поле | Домен/семантика |
|---|---|
| `month` | `YYYY-MM` (contribution_period) |
| `coverage_status` | `COVERED` / `PERIOD_NOT_COVERED` / `UNKNOWN` |
| `contribution_status` | `NO_CONTRIBUTION` / `CONTRIBUTION_PRESENT` / `MULTIPLE_CONTRIBUTIONS` / `UNKNOWN` / `PERIOD_NOT_COVERED` |
| `sender_buckets[]` | `sender_id + type + positive amount + record_ids` |
| `total_by_type` | map\<type,Money\>; пени/unknown исключены |
| `received_dates[]` | все effective rows; `latest_received_date` отдельно |
| `unknown_record_count` | строки, способные изменить статус/сумму |
| `quality_status` | `PASS`/`PASS_WITH_REVIEW`/`NEEDS_REVIEW` |

Детерминированный алгоритм статуса: `PERIOD_NOT_COVERED`→не создавать пропуск; `coverage=UNKNOWN` и нет доказанных positive → `UNKNOWN` (не `NO_CONTRIBUTION`); unresolved critical row → `UNKNOWN`; ≥2 effective positive → `MULTIPLE_CONTRIBUTIONS`; ровно 1 → `CONTRIBUTION_PRESENT`; **только** `coverage=COVERED` + 0 effective positive + нет unknowns → `NO_CONTRIBUTION`.

### 5.5. Coverage / gaps / receipt lag

| Поле | Уровень | Правило |
|---|---|---|
| `report_query_period_start/end` | SOURCE_FACT | 08.02.2026–08.08.2026 |
| `query_period_basis` | SOURCE_FACT interpretation | fixture = `UNKNOWN` |
| `observed_contribution_period_min/max` | CASA_DERIVED | min/max reviewed positive period |
| `observed_month_count` | CASA_DERIVED | уникальные месяцы с effective positive |
| `observed_span_month_count` | CASA_DERIVED | inclusive min…max; **НЕ** coverage |
| `covered_month_count` | CASA_DERIVED | `UNKNOWN`, пока template/policy не докажет coverage |
| `gap_months` | CASA_DERIVED | только месяцы `NO_CONTRIBUTION` |
| `unknown_months` | CASA_DERIVED | coverage/critical ambiguity |
| `receipt_lag_days_from_period_end` | CASA_DERIVED | `received_date − last_day(contribution_period)`; нейтральный факт |
| `candidate_due_date` | CASA_DERIVED | versioned rule (категория плательщика/timing); `UNKNOWN` пока контекст не подтверждён |
| `after_candidate_due_date` | CASA_DERIVED | `received_date > candidate_due_date`; сигнал, не правовой вывод |
| `legal_lateness_status` | CASA_DERIVED | `NOT_EVALUATED`/`UNKNOWN`/`CONFIRMED_BY_RULE_CONTEXT`; дефолт `NOT_EVALUATED`. Правило «до 25-го» само по себе не даёт CASA право писать «просрочено» |

### 5.6. Отправитель (`contribution_sender`, ID-first)

Поля: `sender_id (canonical), sender_identifier (normalized, encrypted, masked), sender_name/aliases, sender_type_if_known, sender_role (CONTRIBUTION_SENDER), first_seen_period/last_seen_period, contribution_count, contribution_month_count, sequence_ranges (по типу), one_off, returned_after_interruption, concurrent_periods`.
Правила: exact normalized identifier → один sender (независимо от пунктуации/регистра имени); разные ID → разные senders даже при совпадении имён; отсутствующий/нечитаемый ID → provisional sender, name-only merge **запрещён** → `MANUAL_REVIEW`. «Работодатель» — только отдельный подтверждённый reviewed факт, не выводится из строки OPV.

### 5.7. КНП registry (versioned, effective-dated)

| КНП | Enum | Смысл | Класс | Base estimate | Источник |
|---|---|---|---|---|---|
| 010 | OPV | Обязательные пенсионные взносы | CONTRIBUTION | CONDITIONAL | S06,S10 |
| 019 | PENALTY_OPV | Пеня за несвоевр. ОПВ | PENALTY | NEVER | S10 |
| 015 | OPPV | Обязат. профессиональные ПВ | CONTRIBUTION | CONDITIONAL | S07,S11 |
| 009 | PENALTY_OPPV | Пеня за ОППВ | PENALTY | NEVER | S11 |
| 089 | OPVR | Обязат. ПВ работодателя | CONTRIBUTION | CONDITIONAL | S08,S12 |
| 098 | PENALTY_OPVR | Пеня за ОПВР | PENALTY | NEVER | S12 |
| 013 | DPV | Добровольные ПВ | CONTRIBUTION | NEVER | S09,S13 |
| иное | UNKNOWN | Неизвестный/новый код | UNKNOWN | NEVER | MANUAL_REVIEW |

Source status effect: `ОБРАБОТАННЫЕ→PROCESSED` (effective positive только если amount>0 и class=CONTRIBUTION); `ВОЗВРАТ/СТОРНО/ОТОЗВАНО→RETURNED/REVERSED` (SOURCE_FACT, не менять totals без signed mapping+linked original — `SAMPLE_REQUIRED`); `ОТКЛОНЕНО/НЕ ОБРАБОТАНО→REJECTED` (не считать поступлением); `неизвестно→UNKNOWN` (`MANUAL_REVIEW`, month может стать UNKNOWN). Пени/возвраты/rejected исключены из positive totals и base estimates.

### 5.8. Оценка дохода из ОПВ (`estimated_contribution_base`) — CASA_DERIVED, предварительная

Только объяснимая математическая оценка; output **никогда** не называется salary / income accepted by bank; `null` — валидный результат.

**Формула:** `estimated_contribution_base = amount / rate` (rate — Decimal ratio, ROUND_HALF_UP, KZT).

**Официальные ставки (не Bank Rule, только eligibility-gate):**
- OPV — обычно **10%** (`10 000 / 0.10 = 100 000`); есть режимы 1% и единый платёж; max 50×МЗП от одного агента; ИП/self-pay база может определяться самим лицом.
- OPPV — **5%** (`10 000 / 0.05 = 200 000`); доход во вредных условиях.
- OPVR — effective-dated: **2026: 3,5%** (`10 000 / 0.035 = 285 714.29`), 2027: 4,5%, 2028: 5%; обычно 1–50×МЗП; special 1% режимы блокируют auto-estimate без category evidence.
- DPV — payer-defined, обратной формулы нет → `NOT_APPLICABLE`.
- PENALTY — не base rate, никогда не инвертировать → `NOT_APPLICABLE`.

**Eligibility gate (E-01…E-07):** распознанный тип (не penalty/return/rejected); amount PRESENT и >0, period PRESENT; `payer_category` подтверждён evidence; `payment_regime` подтверждён (`GENERAL`/`SELF_EMPLOYED_SNR`/`PLATFORM`/`UNIFIED_PAYMENT`/other); effective rate из registry совпадает с периодом и категорией; cap/floor/aggregation известны, correction links разрешены; все input fields ACCEPTED, версия формулы опубликована.

**Output-контракт:** `estimate_status` (`CALCULATED`/`UNKNOWN_RATE_CONTEXT`/`NOT_APPLICABLE`/`NEEDS_REVIEW`), `source_amount` (+record_ids), `contribution_type`/`period`, `rate`, `rate_context` (payer_category+payment_regime+evidence), `formula_version` (напр. `casa.pension.base.opv_general/2026.1`), `estimated_contribution_base`, `confidence` (HIGH/MEDIUM/LOW — не заменяет gates), `limitations[]`, `legal_basis_refs[]`.

**Fixture-решение (`RATE_CONTEXT_REQUIRED`):** КНП 010 доказывает тип OPV, но префикс «ИП» не доказывает режим (employee/self/platform/unified). → `estimate_status = UNKNOWN_RATE_CONTEXT`, `estimated_contribution_base = null`, `missing_context = [payer_category, payment_regime]`. **CASA не показывает угаданные 100 000 ₸.** До RG-04 OPV auto-estimate отключён.

### 5.9. Нейтральный `contribution_profile` (`PROFILE_FORMULA_VERSION = casa.pension.profile/1.0.0`)

`period_start/end` (UNKNOWN если нет positive), `covered_month_count` (UNKNOWN если basis не разрешён), `months_with_contributions`, `months_without_contributions` (не вне coverage), `unknown_months` (+IDs), `continuous_months` (текущая серия до последнего периода; break на NO_CONTRIBUTION/UNKNOWN), `longest_continuous_months`, `latest_contribution_period` (не report end), `latest_received_date` (не document receipt), `unique_sender_count`, `current_sender` (single/multiple/unknown), `contribution_amounts_by_month` (по type/sender, пени исключены), `min/max`, `median` (Decimal 2), `average` (sum/N positive, ROUND_HALF_UP 2).

**Нейтральные сигналы:** `GAP_WITHIN_CONFIRMED_COVERAGE`, `MULTIPLE_CONTRIBUTIONS`, `MULTIPLE_SENDERS`, `SENDER_CHANGE`, `SENDER_RETURN`, `ONE_OFF_SENDER`, `AMOUNT_CHANGE`, `RECEIPT_LAG`, `UNKNOWN_KNP`, `ZERO_OR_BLANK_AMOUNT`, `COVERAGE_UNKNOWN`.
**Запрещённые labels:** «стабильный/нестабильный доход», «хороший/плохой стаж», «доход подтверждён», «банк примет/откажет».

### 5.10. Reconciliation ЕНПФ (`PCR-001…015`)

Snapshot требует `PASS`/`NOT_APPLICABLE`/documented `WAIVER` по каждому critical check.

| Check | Assertion | Severity |
|---|---|---|
| PCR-001 | page_count = max footer N; страницы 1…N уникальны/упорядочены | BLOCK |
| PCR-002 | subject IIN exact normalized match; ФИО supportive | BLOCK |
| PCR-003 | document no/period/received_at согласованы на всех страницах | BLOCK/REVIEW |
| PCR-004 | text-row count = geometry-row count = reviewed effective + excluded | BLOCK |
| PCR-005 | у каждой строки валидные page/bbox/amount/period/sender/id/KNP evidence | BLOCK |
| PCR-006 | contribution_period месяц валиден; нет подмены периодом шапки | BLOCK |
| PCR-007 | received/sent/document dates парсятся; невозможный порядок flagged | REVIEW |
| PCR-008 | KNP registry mapping exact; unknown count явный | BLOCK profile/base |
| PCR-009 | формат/длина sender identifier сохранены; нет name-only silent merge | BLOCK sender profile |
| PCR-010 | CASA row-sum детерминирована; printed total exact если есть | BLOCK если source total present |
| PCR-011 | если source total отсутствует: `source_total_check=NOT_APPLICABLE`, не PASS | BLOCK (инвариант) |
| PCR-012 | нет exact extraction duplicate, считающегося дважды | BLOCK |
| PCR-013 | semantic duplicate candidates разрешены/изолированы | BLOCK snapshot duplication |
| PCR-014 | все UNKNOWN/zero/blank/rejected/penalty строки excluded/included по явной policy | BLOCK metrics |
| PCR-015 | input IDs/hash метрики воспроизводят output | BLOCK |

**Duplicate:** exact SHA-256 → не парсить, показать existing version; semantic candidate = `issuer + document_number + subject_hash + received_at + report_query_period` → reviewer решает; row fingerprint включает transaction/document number (две одинаковые суммы за месяц ≠ duplicate, если номера/даты различаются); без transaction number `month+sender+amount` недостаточно → `MANUAL_REVIEW`; text-layer+OCR на одном bbox = extraction duplicate (объединяются без потери provenance).

---

## ЧАСТЬ 6. Статусы, энумы и коды ошибок

### 6.1. Credit History Engine

**Три несмешиваемых статуса файла/подлинности/извлечения (не выводятся друг из друга):**
- `file_integrity_status`: `VALID` / `CORRUPT` / `HASH_MISMATCH` / `UNREADABLE`
- `authenticity_status`: `VERIFIED_SIGNATURE` / `VERIFIED_BUREAU_MANUAL` / `UNVERIFIED_FLATTENED_PDF` / `UNVERIFIED_SCAN` / `FAILED` / `UNKNOWN`
- `extraction_quality_status`: `PASS` / `PASS_WITH_REVIEW` / `NEEDS_REVIEW` / `FAILED`
- `reconciliation_status`: `PASS` / `PASS_WITH_REVIEW` / `FAIL` / `UNKNOWN`
- `manual_review_status`: `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` / `WAIVED_BY_POLICY`

**Quality gates:** `EXTRACTED` → `NEEDS_REVIEW` → `RECONCILED` → `VERIFIED_FOR_INTERNAL_USE` / `NOT_ELIGIBLE_FOR_SNAPSHOT`.

**Статусы допуска шаблона/типа:** `SUPPORTED` / `SAMPLE_REQUIRED` / `MANUAL_REVIEW` / `CONTRACT_REQUIRED` / `LEGAL_REVIEW_REQUIRED` / `UNKNOWN`; типы отчётов также `UNSUPPORTED_TEMPLATE`, `UNVERIFIED`.

**UI-состояния:** `NOT_UPLOADED`, `CONSENT_REQUIRED`, `UPLOADING`, `QUARANTINED`, `PROCESSING`, `NEEDS_REVIEW`, `PARTIALLY_VERIFIED`, `VERIFIED_FOR_INTERNAL_USE`, `AUTHENTICITY_UNVERIFIED`, `STALE`, `UNSUPPORTED_TEMPLATE`, `SOURCE_MISMATCH`, `FAILED`, `SUPERSEDED`.

**Таксономии:** Product (`LOAN/MICROLOAN/CREDIT_CARD/CREDIT_LINE/INSTALLMENT/MORTGAGE/OVERDRAFT/GUARANTEE/SURETY/OTHER/UNKNOWN`); Creditor (`BANK/MFO/CREDIT_PARTNERSHIP/PAWNSHOP/COLLECTOR/RETAILER/TELECOM_OR_UTILITY/GOVERNMENT/OTHER/UNKNOWN`); Subject role (`BORROWER/CO_BORROWER/JOINT_BORROWER/GUARANTOR/SURETY_PROVIDER/PLEDGOR/OTHER/UNKNOWN`); Phase (`ACTIVE/CLOSED/CLOSED_EARLY/ASSIGNED_OUT/RECALLED/UNKNOWN`; RESTRUCTURED/REFINANCED/REHABILITATED/WRITTEN_OFF/FORGIVEN — события, не фаза); Presence (`PRESENT/EXPLICIT_ZERO/BLANK/NOT_APPLICABLE/UNREADABLE/NOT_IN_TEMPLATE/UNKNOWN`).

**Коды ошибок (HTTP / retryable / blocking):** `CONSENT_MISSING`, `CONSENT_REVOKED`, `FILE_TOO_LARGE`, `FILE_TYPE_MISMATCH`, `PASSWORD_PROTECTED`, `PDF_CORRUPT`, `MALWARE_DETECTED`, `ACTIVE_CONTENT_BLOCKED`, `UNSUPPORTED_REPORT_TYPE`, `UNSUPPORTED_TEMPLATE`, `MISSING_PAGE`, `PAGE_SEQUENCE_INVALID`, `SUBJECT_MISMATCH`, `SIGNATURE_INVALID`, `AUTHENTICITY_UNVERIFIABLE`, `TEXT_LAYER_CORRUPT`, `OCR_SERVICE_UNAVAILABLE`, `PROCESSING_TIMEOUT`, `SCHEMA_DRIFT_DETECTED`, `REQUIRED_FIELD_MISSING`, `SUMMARY_TOTAL_MISMATCH`, `CONTRACT_COUNT_MISMATCH`, `MONEY_TOTAL_MISMATCH`, `ASSIGNMENT_LINK_AMBIGUOUS`, `AMBIGUOUS_CURRENT_NODE`, `NULL_ZERO_AMBIGUOUS`, `REPORT_STALE`, `ACTIVE_RECORD_STALE`, `REVIEW_CONFLICT`, `SNAPSHOT_GATE_FAILED`. Error response: `error_id, code, stage, retryable, blocking, user_message_key, review_task_id, safe_details, occurred_at` (без raw PDF/PII).

### 6.2. Pension Contribution Engine

**Проверки/поля V-01…V-09:** `file_integrity_status` (`VALID/CORRUPT/UNREADABLE/HASH_MISMATCH/QUARANTINED`), `completeness_status` (`VALID/INCOMPLETE/UNKNOWN`), `template_status` (`SUPPORTED/UNSUPPORTED_TEMPLATE`), `subject_status` (`MATCH/SUBJECT_MISMATCH/UNKNOWN`), `header_status` (`VALID/NEEDS_REVIEW`), `authenticity_status`, `duplicate_status` (`UNIQUE/EXACT_DUPLICATE/SEMANTIC_DUPLICATE_CANDIDATE/REVIEW`), `freshness_status` (`CURRENT/STALE/UNKNOWN`).

**`authenticity_status`:** `VERIFIED_PDF_SIGNATURE` / `VERIFIED_EGOV_MANUAL` / `BARCODE_PRESENT_UNVERIFIED` / `UNKNOWN` / `FAILED`. Fixture = `BARCODE_PRESENT_UNVERIFIED`.

**`extraction_quality_status`:** `PASS/PASS_WITH_REVIEW/NEEDS_REVIEW/FAILED`. **`reconciliation_status`:** `PASS/PASS_WITH_REVIEW/FAIL/NOT_APPLICABLE`. **`manual_review_status`:** `NOT_STARTED/IN_PROGRESS/COMPLETED/WAIVED`.

**Статусы шаблонов:** `SUPPORTED_V1` / `SUPPORTED_WITH_REVIEW` / `SAMPLE_REQUIRED` / `UNSUPPORTED_TEMPLATE` / `NOT_SUPPORTED`.

**Presence:** `PRESENT/EXPLICIT_ZERO/BLANK/UNREADABLE/NOT_APPLICABLE/UNKNOWN`. **`processing_effect`:** `EFFECTIVE/EXCLUDED/UNKNOWN`. **`source_status`:** `PROCESSED/RETURNED/REVERSED/REJECTED/UNKNOWN`.

**UI-состояния:** `NOT_UPLOADED`, `CONSENT_REQUIRED`, `UPLOADING/QUARANTINED`, `PROCESSING`, `VALID`, `NEEDS_REVIEW`, `SUBJECT_MISMATCH`, `INCOMPLETE`, `UNSUPPORTED_TEMPLATE`, `CONFIRMED`, `STALE`, `FAILED`, `SUPERSEDED`.

**Особый флаг источника:** `SOURCE_LEGAL_TEXT_OUTDATED` (+`NEEDS_REVIEW`) — устаревшая правовая ссылка в футере; **не** объявляет документ поддельным.

**Коды ошибок:** `INVALID_FILE`, `CORRUPT_PDF`, `MALWARE_DETECTED`, `PDF_PASSWORD_REQUIRED`, `SUBJECT_MISMATCH`, `INCOMPLETE_DOCUMENT`, `UNSUPPORTED_TEMPLATE`, `EXACT_DUPLICATE`, `SEMANTIC_DUPLICATE_REVIEW`, `CRITICAL_FIELD_UNREADABLE`, `UNKNOWN_KNP`, `UNKNOWN_STATUS`, `RECONCILIATION_FAILED`, `AUTHENTICITY_UNVERIFIED`, `AUTHENTICITY_FAILED`, `REPORT_STALE`, `SNAPSHOT_GATE_FAILED`, `REVIEW_CONFLICT`.

---

## ЧАСТЬ 7. Legal / format gates (нельзя включать без юр-решения или реального образца)

### 7.1. Credit History Engine

**LEGAL_REVIEW_REQUIRED:**
- Точный текст/форма consent (upload, extraction, internal use, transfer to future Bank Rules) — OQ-01.
- Роли controller/operator/processor (CASA/tenant/бюро/OCR vendor) — OQ-02.
- Retention matrix (PDF, crops, fields, snapshots, audit по стадиям) — OQ-03; срок CASA ≠ 5-летний срок бюро.
- Нужен ли договор с бюро для ручной обработки клиентского PDF — OQ-05.
- Какие embedded state facts правомерно показывать риелтору — OQ-16 (в v1 collapsed/masked).
- Можно ли хранить evidence crop отдельно от PDF — OQ-17.
- OCR/AI subprocessor и локация обработки — OQ-18 (no training on customer data).
- Логотипы/названия бюро в UI — OQ-19.
- Data residency/deployment в РК — раздел безопасности.

**SAMPLE_REQUIRED (нельзя включать parser без ≥20 обезличенных полных PDF + gold set):**
- ГКБ (SCB) full personal PDF — OQ-06.
- ПКБ (FCB) personal/non-full PDF — OQ-07.
- eGov PDFs (определить underlying bureau/layout/signatures) — OQ-08.
- Все product/source/role enum mappings в реальных шаблонах — OQ-11.
- Facility vs drawdown в каждом формате — OQ-12.

**CONTRACT_REQUIRED:** прямой API/выгрузка бюро (не v1); авто-проверка подлинности FCB — OQ-04 (+`UNKNOWN`; до ответа ПКБ — только manual); direct bureau API — OQ-20 (+LEGAL_REVIEW_REQUIRED).

**UNKNOWN (открытые вопросы):** template change notification feed — OQ-09; часовой пояс report timestamp — OQ-10; объём/семантика partial report — OQ-13; process freshness TTL — OQ-14 (product decision); отображение disputed info — OQ-15.

> Единственный SUPPORTED в v1: **FCB full personal PDF layout**, покрытый regression-fixture. Всё остальное — SAMPLE_REQUIRED / manual fallback за feature flag.

### 7.2. Pension Contribution Engine — Release Gates RG-01…RG-09 (все OPEN)

| Gate | Тема | Что блокирует до закрытия | Метка |
|---|---|---|---|
| RG-01 | Coverage semantics | `covered_month_count`/`NO_CONTRIBUTION`; до закрытия — только «наблюдаемые месяцы» | OPEN (SAMPLE/doc) |
| RG-02 | Authenticity | Авто-проверка штрих-кода/QR/подписи запрещена; только manual SOP | OPEN |
| RG-03 | Legal/privacy | consent/access/export/retention/deletion для пенсионных данных | OPEN · LEGAL_REVIEW_REQUIRED |
| RG-04 | Base formula registry | OPV auto-estimate отключён; `estimated_contribution_base` для КНП 010 = `UNKNOWN` | OPEN |
| RG-05 | Status/return samples | mapping возвратов/сторно/отклонений — до образцов `UNKNOWN` | OPEN · SAMPLE_REQUIRED |
| RG-06 | Template pack | отдельные образцы для eGov-справки и ENPF IPS до заявления о поддержке | OPEN · SAMPLE_REQUIRED |
| RG-07 | Freshness policy | process TTL (дефолт 30 дней) + UI copy | OPEN |
| RG-08 | Gold dataset | все 40 тестов, шаблоны/языки/сканы, ≥98% critical KPI | OPEN |
| RG-09 | Source footer issue | трактовка устаревшего правового футера | OPEN |

**CONTRACT_REQUIRED / LEGAL_REVIEW_REQUIRED (ЕНПФ):** авто-вызов официального check-service — OQ-03 (LEGAL+CONTRACT); формат payload штрих-кода/проверка ЭЦП — OQ-02 (CONTRACT/RG-02). Публичное право CASA на автоматизированный вызов **не подтверждено** — до договора только MANUAL_REVIEW; не автоматизировать browser/CAPTCHA/личный кабинет.

**SUPPORTED_V1:** только `GOVCORP_ENPF_MOVEMENT_RU_KK_2026` (fixture). eGov-справка `EGOV_PENSION_DEDUCTION_CERT` и `ENPF_IPS_STATEMENT` — SAMPLE_REQUIRED; фото/скриншот/xls/квитанция — NOT_SUPPORTED (только как evidence).

---

## ЧАСТЬ 8. Regression-fixture ожидания (чек-лист для тестов)

### 8.1. Кредитная история — паспорт образца (ПКБ, 29 стр., 08.08.2026 09:51:38)

| Метрика | Ожидаемое значение | Тест |
|---|---|---|
| bureau / kind | `FCB` / `FULL_PERSONAL` | CH-011 |
| pages_actual = pages_declared | 29 = 29, sequence 1…29 | CH-012 |
| authenticity_status | `UNVERIFIED_FLATTENED_PDF` (не «Подтверждён») | CH-017 |
| Активные source records | 3 (2 карты + 1 банк. займ) | CH-031/032 |
| Закрытые source records | 25 (включая коллектора) | — |
| Source records старше 5 лет | 2 | — |
| Всего source contract records | 30 | CH-041 |
| Уникальные contract codes | 29 (код `1705551` дважды) | CH-041 |
| Канонические obligation lineages | 29 | CH-041 |
| `total_outstanding_by_currency.KZT` | `4737798.64` (2 990 763,90 + 176 009,00 + 1 571 025,74) | CH-033 |
| `total_reported_payment_by_currency.KZT` | `211711.02` (132 768 + 26 710 + 52 233,02; для карт — min payment) | CH-034 |
| `card_limits_by_currency.KZT` | `3437876.00` | CH-035 |
| `card_utilized_by_currency.KZT` | `3166772.90` | CH-035 |
| `active_current_delinquency_count` / `max_current_dpd` | 0 / 0 | CH-036 |
| `active_card_count` / `active_mfo_count` | 2 / 0 | CH-035/062 |
| `source_records_with_historical_dpd_count` | 8 | CH-057 |
| `canonical_lineages_with_historical_dpd_count` | 7 (после объединения `1705551`) | CH-058 |
| `max_dpd_lifetime` | 1919 (коллектор; не текущая просрочка) | CH-059 |
| MFO source contract records | 24 | CH-062 |
| `collector_lineage_count` | 1 | — |
| `rehabilitated_lineage_count` | 1 | CH-052 |
| Заявки в окне 30 дней | 2 (разные application IDs) | CH-064 |
| Запросы всего | 130 | CH-067 |
| `inquiry_count_30d/90d/180d` | 1 / 11 / 33 | CH-068 |
| `creditor_inquiry_count_180d` | 32 | CH-069 |
| `self_inquiry_count_180d` | 1 (30/90 = 0/0) | CH-069 |
| `bureau_rating_fact` | value 636, as_of 2024-07-08 (старше отчёта) | CH-072 |
| Chain `1705551` | 2 source rows, 1 lineage, current balance 0, lineage max DPD 1919 | CH-042/043/045 |

### 8.2. ЕНПФ — паспорт образца (GOVCORP, 2 стр., 08.08.2026 09:56:29)

| Метрика | Ожидаемое значение | Тест |
|---|---|---|
| Страницы / строки | 2/2 · 6 строк | PC-001 |
| Периоды | 01.2026–06.2026 (по строкам) | PC-001 |
| Сумма каждой строки / CASA row-sum | 10 000,00 · **60 000,00 KZT** | PC-001 |
| `source_printed_total_presence` | `NOT_APPLICABLE` (итог в PDF не напечатан) | PCR-011 |
| Отправитель / ID | 1 (ИП RSHATOVA, один 12-значный ID) | PC-001 |
| КНП / класс / статус | 010 (OPV / CONTRIBUTION) · все `PROCESSED` | PC-001 |
| `positive_observed_months` / `observed_span_month_count` | 6 / 6 | — |
| `covered_month_count` | **UNKNOWN** (coverage не подтверждена) | — |
| `months_without_contributions` | **UNKNOWN** | — |
| `unique_sender_count` / `current_sender_status` | 1 / `SINGLE` | — |
| min/max/median/average | 10 000 ₸ | PC-014/015 |
| `estimated_contribution_base` | **UNKNOWN** (`UNKNOWN_RATE_CONTEXT`; missing payer_category, payment_regime) | PC-019 |
| `authenticity_status` | `BARCODE_PRESENT_UNVERIFIED` | PC-039 |
| Правовой футер | `SOURCE_LEGAL_TEXT_OUTDATED` + `NEEDS_REVIEW` (Закон №370-II → Цифровой кодекс №255-VIII) | PC-040 |
| `query_period_basis` | `UNKNOWN` (период шапки 08.02–08.08.2026 ≠ покрытие) | — |
| SHA-256 / bytes / PDF | `407e9a07…548d76` / 191 258 / PDF 1.4, rotation 90° | PC-001 |

Строки fixture (period → received/sent/doc.date → doc.№ → сумма → страница):
`01.2026 → 19.02.2026 ×3 → 18 → 10 000 → стр.1` · `02.2026 → 26.03/26.03/24.03 → 29 → 10 000 → стр.1` · `03.2026 → 12.05.2026 ×3 → 48 → 10 000 → стр.2` · `04.2026 → 10.06.2026 ×3 → 58 → 10 000 → стр.2` · `05.2026 → 29.06/29.06/27.06 → 64 → 10 000 → стр.2` · `06.2026 → 03.08.2026 ×3 → 78 → 10 000 → стр.2`.

---

## Приложение. Реестр официальных источников (для versioned source registry)

**Кредитная история (S01–S17):** Закон о персональных данных (S01, Z1300000094), Закон о кредитных бюро (S02, Z040000573_), АРРФР — формирование КИ (S03), реестр бюро (S04), eGov «как узнать КИ» (S05), ПКБ ПКО (S06, 1cb.kz/product-buy/pko), ПКБ проверка подлинности (S07, 1cb.kz/report-auth — сканы не проверяются), ПКР (S08), «Реабилитирован» (S09), ГКБ Wiki сервис/получение отчётов (S10/S11 — нужен договор), Smart Bridge ORGCG-S-6709 (S12), ПКБ оспаривание — 10 раб.дней/коллекторы 30 кал.дней (S13), Комитет ИБ (S14), мин. требования V1700015115 (S15 — отчёт полный/частичный), ГКБ персональный (S16), ГКБ техдок (S17).

**ЕНПФ (S01–S19):** eGov начисления ЕНПФ — два разных сервиса (S01, beta.egov.kz/services/3549), Әділет приказ №30712 (S02), gov.kz проверка документов по ИИН+код (S03, services/4034), Закон о перс. данных (S04), Социальный кодекс K2300000224 (S05), ЕНПФ ОПВ 10% (S06), ОППВ 5% (S07), ОПВР 3,5% 2026 (S08), ДПВ (S09), КНП ОПВ 010/019 (S10), КНП ОППВ 015/009 (S11), КНП ОПВР 089/098 (S12), КНП ДПВ 013 (S13), самозанятые 1% (S14), платформенная занятость 1% (S15), единый платёж (S16), возвраты (S17), Закон №370-II утратил силу (S18, Z030000370_), Цифровой кодекс №255-VIII ст.62 (S19, K2600000255).

> **Temporal rule (оба движка):** каждая запись registry (КНП/ставка/статус/шаблон/источник) хранит `source URL, checked_at, effective_from/to, registry_version`. Устаревший registry **отключает** auto-estimate, а не молча переиспользует старую ставку/маппинг.
