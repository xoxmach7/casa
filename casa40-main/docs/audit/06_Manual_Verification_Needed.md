# 06 — Manual Verification Needed

Список пунктов, которые невозможно подтвердить только по коду и требуют ручной проверки в Supabase Dashboard, production-среде или через SQL-запросы.

---

## 1. DB Triggers привязаны к таблицам

**Проблема**: В API `<db-triggers>` указано "There are no triggers in the database", хотя trigger-функции `on_property_inserted()` и `on_lead_inserted()` существуют.

**Проверка**:
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

**Ожидаемый результат**: Должны быть AFTER INSERT triggers на таблицах `properties` и `leads`.

---

## 2. Vault secret совпадает с Edge Functions secret

**Проблема**: `NOTIFY_WEBHOOK_SECRET` должен быть одинаковым в двух местах:
1. Supabase Edge Functions secrets
2. Vault (`vault.decrypted_secrets` с именем `notify_webhook_secret`)

**Проверка**: Сравнить значения через Supabase Dashboard (Vault + Edge Function settings).

---

## 3. public_properties view SQL

**Проблема**: Точный SQL view недоступен через код — логика фильтрации (`payment_status != 'paid'`) подтверждена только по документации.

**Проверка**:
```sql
SELECT pg_get_viewdef('public_properties', true);
```

---

## 4. pg_net расширение активно

**Проблема**: DB functions используют `net.http_post()` из расширения `pg_net`. Если расширение не активировано — trigger-функции падают.

**Проверка**:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

---

## 5. Resend API email delivery

**Проблема**: Edge Functions используют `onboarding@resend.dev` как отправителя. Resend ограничивает этот адрес.

**Проверка**: 
- Проверить логи Edge Functions в Supabase Dashboard
- Проверить статус домена в Resend Dashboard

---

## 6. Storage bucket policies

**Проблема**: Buckets `property-photos` и `floor-plans` публичные, но storage RLS policies для upload/delete не видны из кода.

**Проверка**: Supabase Dashboard → Storage → Policies для каждого bucket.

**Риски**:
- Может ли анонимный пользователь удалять чужие файлы?
- Есть ли ограничение на размер файла?

---

## 7. Profile creation trigger

**Проблема**: RLS на `profiles` запрещает INSERT. Но профили должны создаваться при регистрации пользователя.

**Проверка**: Проверить наличие trigger на `auth.users` для автоматического создания записи в `profiles`.

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'auth';
```

**Примечание**: Modifying triggers on `auth` schema is restricted. Trigger может быть на уровне Supabase Auth hooks.

---

## 8. TomTom API key domain restriction

**Проблема**: Ключ `40nH6NdVknh4cEQN9bAO3MI2rNiek0y7` hardcoded. В коде указано "domain-whitelisted".

**Проверка**: Подтвердить в TomTom Developer Portal, что ключ ограничен доменами `casa40.lovable.app` и `localhost`.

---

## 9. Supabase default row limit

**Проблема**: Supabase возвращает максимум 1000 строк по умолчанию. Все запросы в проекте используют `select('*')` без пагинации.

**Проверка**: Если количество properties или leads превышает 1000 — данные будут обрезаны.

---

## 10. Содержимое миграций 04-07

**Проблема**: 3 миграции от 2026-04-07 предположительно создают DB triggers для уведомлений. Содержимое файлов read-only.

**Проверка**: Просмотреть SQL миграций для подтверждения:
```
supabase/migrations/20260407010747_*.sql
supabase/migrations/20260407010829_*.sql
supabase/migrations/20260407014446_*.sql
```

---

## Чеклист ручной проверки

| # | Проверка | Как | Приоритет |
|---|----------|-----|-----------|
| 1 | DB triggers привязаны | SQL query | 🔴 Критично |
| 2 | Vault secret = Edge secret | Dashboard | 🔴 Критично |
| 3 | pg_net активен | SQL query | 🔴 Критично |
| 4 | public_properties view SQL | SQL query | 🟡 Важно |
| 5 | Resend email delivery | Edge Function logs | 🟡 Важно |
| 6 | Storage bucket policies | Dashboard | 🟡 Важно |
| 7 | Profile creation trigger | SQL query | 🟡 Важно |
| 8 | TomTom domain restriction | TomTom Portal | 🟢 Желательно |
| 9 | Row limit > 1000 | Мониторинг данных | 🟢 Желательно |
| 10 | Миграции 04-07 | Чтение SQL файлов | 🟢 Информационно |
