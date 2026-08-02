# 03 — Database & Supabase Summary

## Таблицы

### properties
- **Enum**: `property_status` (`new`, `published`, `showing`, `in_deal`)
- **Ключевые поля**: `id`, `status`, `is_archived`, `district`, `address`, `house_number`, `residential_complex`, `price`, `rooms`, `area`, `floor`, `total_floors`, `building_type`, `year_built`, `ceiling_height`, `layout`, `bathroom_type`, `renovation_condition`, `balcony`, `negotiable`, `ready_to_move_in`, `has_furniture`, `has_appliances`, `owner_flag`, `seller_name`, `seller_phone`, `seller_whatsapp`, `best_contact_time`, `photo_urls`, `floor_plan_url`, `description`, `title`, `lat`, `lng`, `verification_checklist`, `selected_lead_id`, `payment_status`, `payment_amount`, `payment_receipt_url`, `payment_comment`
- **FK**: `selected_lead_id` → `leads.id`
- **Defaults**: `status='new'`, `is_archived=false`, `payment_status='unpaid'`, `photo_urls='{}'`, booleans default `false`

### leads
- **Enum**: `lead_status` (`new`, `showing`, `in_deal`)
- **Ключевые поля**: `id`, `property_id`, `status`, `buyer_name`, `buyer_phone`, `viewing_datetime`, `financing_type`, `financing_bank`, `pre_approved`, `mortgage_amount`, `expected_timeline`, `comment`
- **FK**: `property_id` → `properties.id` (also references `public_properties` view)
- **Defaults**: `status='new'`, `pre_approved=false`

### profiles
- **Enum**: `profile_role` (`admin`, `operator`, `user`)
- **Поля**: `id` (FK→auth.users), `role`, `full_name`, `created_at`, `updated_at`
- **Defaults**: `role='user'`

## Views

### public_properties
- **Тип**: Security definer view
- **Назначение**: Публичный доступ к квартирам без PII продавца
- **Исключённые поля**: `seller_name`, `seller_phone`, `seller_whatsapp`, `best_contact_time`, `payment_status`, `payment_receipt_url`, `payment_amount`, `payment_comment`, `selected_lead_id`, `verification_checklist`, `updated_at`
- **Фильтрация**: `status IN (published, showing)`, `is_archived = false`, `payment_status != 'paid'` — **не подтверждено по коду фронтенда, логика внутри view SQL**

## Storage Buckets

| Bucket | Public | Используется в |
|--------|--------|----------------|
| `property-photos` | ✅ | AddListing (seller upload), AdminObjectCard (admin upload/replace) |
| `floor-plans` | ✅ | AddListing (seller upload), AdminObjectCard (admin upload/replace) |
| `payment-receipts` | ❌ | AdminObjectCard (payment confirmation) |

**Утилиты**: `src/hooks/useStorage.ts` — `uploadPropertyPhoto`, `uploadFloorPlan`, `uploadPaymentReceipt`

## DB Functions (подтверждены)

| Функция | Тип | Назначение |
|---------|-----|------------|
| `get_my_role()` | SQL, SECURITY DEFINER | Возвращает роль текущего пользователя из `profiles` |
| `on_property_inserted()` | PL/pgSQL, SECURITY DEFINER | Webhook → Edge Function при INSERT в properties |
| `on_lead_inserted()` | PL/pgSQL, SECURITY DEFINER | Webhook → Edge Function при INSERT в leads |
| `set_updated_at()` | PL/pgSQL | Trigger для обновления `updated_at` |
| `rls_auto_enable()` | PL/pgSQL, EVENT TRIGGER | Автоматически включает RLS на новых таблицах |

## DB Triggers

⚠️ **В секции `<db-triggers>` указано "There are no triggers in the database"**, хотя функции `on_property_inserted` и `on_lead_inserted` существуют. Это может означать:
1. Триггеры были созданы, но информация не отображается в текущем API
2. Триггеры ещё не привязаны к таблицам

**Требует ручной проверки** через SQL:
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

## Миграции

Файлы в `supabase/migrations/` (16 файлов, с 2026-03-19 по 2026-04-07):
- Ранние миграции (03-19 — 03-21): Создание таблиц, view, RLS policies, functions
- Поздние миграции (04-07): Предположительно DB triggers для notifications

**Содержимое миграций read-only — не модифицируется.**

## Edge Functions

| Функция | Путь | Назначение |
|---------|------|------------|
| `notify-new-property` | `supabase/functions/notify-new-property/index.ts` | Email-уведомление админу о новой квартире |
| `notify-new-lead` | `supabase/functions/notify-new-lead/index.ts` | Email-уведомление админу о новой заявке |

**Общая схема**:
1. Валидация `x-webhook-secret` из заголовка
2. Проверка record exists в DB (через service role)
3. Формирование HTML email
4. Отправка через Resend API
5. Получатель: `ALERT_EMAIL`

## Secrets (Edge Functions)

Используемые (подтверждены по коду):
- `RESEND_API_KEY` — для Resend API
- `ALERT_EMAIL` — адрес получателя уведомлений
- `SUPABASE_URL` — URL проекта (серверный)
- `SUPABASE_SERVICE_ROLE_KEY` — service role ключ
- `NOTIFY_WEBHOOK_SECRET` — секрет для аутентификации webhook-вызовов

Дополнительно настроены (назначение не подтверждено по коду Edge Functions):
- `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_TOMTOM_API_KEY`, `LOVABLE_API_KEY`, `casa-prod`

## Vault

- `notify_webhook_secret` — используется в DB функциях `on_property_inserted` и `on_lead_inserted` для аутентификации вызовов к Edge Functions
