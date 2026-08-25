# CASA Pro Ипотека — статус реализации по утверждённым докам (M01→M06)

> Governance-решение заказчика от **2026-08-25**: реализуем строго по
> утверждённым документам (MASTER v1.2 FROZEN, M06 v1.4 APPROVED_FROZEN,
> M01–M05). Новые продуктовые функции и новые governance-решения не добавляем.
> Замороженные CSV (`CSV_FOR_DEVELOPMENT_V3_1/`) и `.docx` — источник истины,
> лежат рядом с кодом в `docs/casadocs/` (версионируются, едут с билдом).

## 1. ОПВ → доход: откачено (строго по спеке M04)

Формула «ОПВ / 10% = доход» и производная «доход × 50% = лимит кредитных
платежей» **удалены**. По M04 факт ОПВ (КНП 010) не даёт применить ставку 10%.
До закрытия условий **E-01…E-07** и **RG-04**:

- `estimated_contribution_base = null`
- `estimate_status = UNKNOWN_RATE_CONTEXT`

Банковский/официальный КДН не считается: **REG-F-001 `reg.kz.kdn.bank` = DISABLED**,
`value = null` до появления утверждённых exact regulatory inputs (PNZ/PP/PZ/D)
и applicability context.

Код: [`extraction.ts`](../../delivery/backend/src/lib/mortgage-workspace/extraction.ts)
(`pensionContributionBase()`; поля `estimated_monthly_income` /
`estimated_payment_limit` больше не выпускаются).
`12_GOVERNANCE_DECISIONS.csv` ради сохранения старой формулы **не менялся**.

## 2. Расчётный движок M06 (CALC-F-001 / CALC-F-002) — реализован строго

Код: [`m06-calc.ts`](../../delivery/backend/src/lib/mortgage-workspace/m06-calc.ts)

- **CALC-F-001** `casa.required_financing` v1.0.0 — `F = max(P − A_now, 0)`.
- **CALC-F-002** `casa.annuity_payment_by_parameters` v1.0.0 — ветки
  `P=0→0`, `r=0,n>0→P/n`, `r>0,n>0→аннуитет`, иначе `INVALID_INPUT`.
- Контракт точности M06 §18: внутренние операции 50 знаков `ROUND_HALF_EVEN`;
  персист `Decimal(20,2) ROUND_HALF_UP` один раз; показ — целые ₸ `ROUND_HALF_UP`.
- unknown_policy: требуемый вход UNKNOWN → `value=null` + blocker
  `MISSING_REQUIRED_INPUT`; невалидные term/rate/frequency → `INVALID_INPUT`.
  Ноль вместо UNKNOWN не подставляется.

## 3. Release Gates RG10 / RG11 / RG12 — остаются NOT_PASS

Сам факт реализации и утверждение M06 v1.4 **не переводят** gate в PASS
(DEC-RG10-001). Runtime-evidence fixtures (positive / negative / boundary /
UNKNOWN / invalid) для CALC-F-001/002:
[`mortgage-workspace.m06-calc.test.ts`](../../delivery/backend/src/__tests__/mortgage-workspace.m06-calc.test.ts).

Перевод RG10–12 в PASS выполняет владелец только после фактического прохождения
соответствующих acceptance-тестов и golden E2E с зафиксированным evidence.
До этого — никаких отметок «готово к production» по этим gates.

## 4. API namespace — canonical `/api/v2/cases` (DEC-API-001)

Реконсиляция с параллельной работой (PR #7 «codex/mortgage-working-module»),
которая внесла **реальный M01 case-ресурс** (`mortgage-cases.routes.ts`:
Prisma `MortgageCase`, participants, consent revisions, idempotency,
optimistic concurrency, audit) — но смонтировала его на **`/api/v1/mortgage-cases`**,
что расходится с FROZEN-решением DEC-API-001 (canonical = `/api/v2/cases`).

Приведено к утверждённому контракту:

- Основной canonical маунт: `app.use('/api/v2/cases', mortgageCasesRouter)` —
  это и есть «base case resource, M01 owns» из DEC-API-001.
- `/api/v1/mortgage-cases` оставлен **временным транзит-алиасом** (тот же
  роутер) ради безопасной миграции; `TODO(migration)` к удалению.
- Фронт `lib/mortgage/case-api.ts` и тесты переведены на `/v2/cases`.
- **Демо-рабочий экран** (`mortgage-workspace.routes.ts`: whatif/documents/
  conclusions/demo) — отдельная demo-поверхность, НЕ canonical case-ресурс:
  остаётся на `/api/mortgage-workspace` (перенос его на `/api/v2/cases` дал бы
  коллизию с реальным case-роутером). Фронт ипотечного экрана без изменений.

> Флаг для заказчика: PR #7 использовал `/api/v1/mortgage-cases` вопреки
> DEC-API-001. Здесь исправлено на canonical `/api/v2/cases` (v1 — транзит).
> Если команда сознательно хочет v1 — вернуть решение на согласование.

## 5. Хранение доков («Docker»)

Согласованный вариант: доки — источник истины рядом с кодом в `docs/casadocs/`
(версионируются, едут с репозиторием/билдом). В runtime-образ 10 МБ CSV/`.docx`
не бэйкаются (не нужны в рантайме). Нормативную/расчётную логику M01–M06 это
не меняет.
