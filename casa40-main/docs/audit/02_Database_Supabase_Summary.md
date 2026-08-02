# 02 — Database & Supabase Summary

> Полная сводка по БД, Storage, Edge Functions, DB Functions и Vault.

---

## Таблицы

### properties (35+ колонок)

- **Enum**: `property_status` (`new`, `published`, `showing`, `in_deal`)
- **Identity**: `id` (uuid, default `gen_random_uuid()`), `created_at`, `updated_at`
- **Status**: `status` (default `'new'`), `is_archived` (default `false`)
- **Location**: `district`, `address`, `house_number`, `residential_complex`, `lat` (double), `lng` (double)
- **Price/Specs**: `price` (numeric), `rooms` (int), `area` (numeric), `floor` (int), `total_floors` (int), `building_type`, `year_built` (int), `ceiling_height` (numeric)
- **Features**: `layout`, `bathroom_type`, `renovation_condition`, `balcony` (bool), `negotiable` (bool), `ready_to_move_in` (bool), `has_furniture` (bool), `has_appliances` (bool)
- **Seller PII**: `seller_name` (NOT NULL), `seller_phone` (NOT NULL), `seller_whatsapp`, `owner_flag` (default `true`), `best_contact_time`
- **Media**: `photo_urls` (text[], default `'{}'`), `floor_plan_url`, `title`, `description`
- **Admin**: `verification_checklist` (jsonb, default `'{}'`), `selected_lead_id` (uuid FK→leads.id)
- **Payment**: `payment_status` (default `'unpaid'`), `payment_amount` (numeric), `payment_receipt_url`, `payment_comment`

### leads (14 колонок)

- **Enum**: `lead_status` (`new`, `showing`, `in_deal`)
- **Identity**: `id` (uuid), `created_at`, `updated_at`
- **Link**: `property_id` (uuid FK→properties.id, also references `public_properties` view)
- **Buyer**: `buyer_name` (NOT NULL), `buyer_phone` (NOT NULL)
- **Status**: `status` (default `'new'`)
- **Scheduling**: `viewing_datetime` (timestamptz)
- **Financing**: `financing_type`, `financing_bank`, `pre_approved` (bool, default `false`), `mortgage_amount` (numeric), `expected_timeline`
- **Notes**: `comment`

### profiles (5 колонок)

- **Enum**: `profile_role` (`admin`, `operator`, `user`)
- `id` (uuid FK→auth.users), `role` (default `'user'`), `full_name`, `created_at`, `updated_at`

---

## Views

### public_properties

- **Тип**: Security definer view (работает с правами владельца)
- **Назначение**: Публичный доступ к квартирам без PII продавца
- **Исключённые поля**: `seller_name`, `seller_phone`, `seller_whatsapp`, `best_contact_time`, `payment_status`, `payment_receipt_url`, `payment_amount`, `payment_comment`, `selected_lead_id`, `verification_checklist`, `updated_at`
- **Фильтрация (предполагаемая)**: `status IN ('published', 'showing')`, `is_archived = false`, `payment_status != 'paid'`
- ⚠️ **Точный SQL view не подтверждён по коду фронтенда — логика внутри view SQL**

---

## Storage Buckets

| Bucket | Public | Используется в | Утилита |
|--------|--------|----------------|---------|
| `property-photos` | ✅ | AddListing (seller), AdminObjectCard (admin) | `uploadPropertyPhoto()` |
| `floor-plans` | ✅ | AddListing (seller), AdminObjectCard (admin) | `uploadFloorPlan()` |
| `payment-receipts` | ❌ | AdminObjectCard (payment) | `uploadPaymentReceipt()` (возвращает path, не publicUrl) |

Утилиты в `src/hooks/useStorage.ts`. Путь генерируется как `{propertyId}/{prefix}-{uuid8}.{ext}`.

AddListing загружает фото в `uploads/{uuid8}.{ext}` (без propertyId, т.к. ID ещё не создан).

---

## DB Functions (подтверждены по коду)

| Функция | Тип | search_path | Назначение |
|---------|-----|-------------|------------|
| `get_my_role()` | SQL, STABLE, SECURITY DEFINER | `''` | Возвращает `profile_role` для `auth.uid()` |
| `on_property_inserted()` | PL/pgSQL, SECURITY DEFINER | `'public'` | Webhook → Edge Function при INSERT в properties |
| `on_lead_inserted()` | PL/pgSQL, SECURITY DEFINER | `'public'` | Webhook → Edge Function при INSERT в leads |
| `set_updated_at()` | PL/pgSQL | — | BEFORE UPDATE trigger: `new.updated_at = now()` |
| `rls_auto_enable()` | PL/pgSQL, SECURITY DEFINER, EVENT TRIGGER | `'pg_catalog'` | Auto RLS на новых таблицах в public |

### Trigger Functions Details

`on_property_inserted()` и `on_lead_inserted()`:
1. Читают `notify_webhook_secret` из `vault.decrypted_secrets`
2. Формируют URL из `app.settings.supabase_url` или fallback `https://rekpjnncrvctaxymqxpn.supabase.co`
3. Вызывают `net.http_post()` к `/functions/v1/notify-new-{property|lead}`
4. Передают `row_to_json(NEW)` в body, секрет в `x-webhook-secret` header
5. При отсутствии секрета — RAISE WARNING и RETURN NEW (не блокируют INSERT)

---

## DB Triggers

⚠️ **В API `<db-triggers>` указано "There are no triggers in the database"**, хотя trigger functions существуют. Возможные причины:
1. Триггеры созданы, но API не отображает их
2. Триггеры ещё не привязаны к таблицам

**Требует ручной проверки**:
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

---

## Edge Functions

### notify-new-property (`supabase/functions/notify-new-property/index.ts`)
- Валидация `x-webhook-secret` → 403 если не совпадает
- Проверка `record.id` exists в properties (service role) → 404 если нет
- HTML email: район/адрес, ЖК, цена, комнаты/площадь, продавец/телефон
- Отправка через Resend API: `from: "CASA <onboarding@resend.dev>"`, `to: ALERT_EMAIL`
- Ссылка: `https://casa40.lovable.app/admin/objects`

### notify-new-lead (`supabase/functions/notify-new-lead/index.ts`)
- Аналогичная структура
- Дополнительно: загрузка property details для контекста email
- HTML email: квартира (район/адрес/цена), покупатель/телефон
- Ссылка: `https://casa40.lovable.app/admin/leads`

---

## Secrets

### Edge Functions (подтверждены по коду)
- `RESEND_API_KEY` — API ключ Resend
- `ALERT_EMAIL` — адрес получателя уведомлений
- `SUPABASE_URL` — URL проекта (серверный)
- `SUPABASE_SERVICE_ROLE_KEY` — service role ключ
- `NOTIFY_WEBHOOK_SECRET` — секрет для аутентификации webhook

### Настроены в Dashboard, но не подтверждены по коду Edge Functions
`SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_TOMTOM_API_KEY`, `LOVABLE_API_KEY`, `casa-prod`

### Vault
- `notify_webhook_secret` — используется в DB функциях для аутентификации вызовов Edge Functions

---

## Миграции

16 файлов в `supabase/migrations/` (read-only):

| Период | Файлы | Предполагаемое содержание |
|--------|-------|--------------------------|
| 2026-03-19 | 1 | Начальная схема |
| 2026-03-20 | 8 | Таблицы, view, RLS policies, functions |
| 2026-03-21 | 4 | Доработки схемы |
| 2026-04-07 | 3 | Предположительно DB triggers для уведомлений |
