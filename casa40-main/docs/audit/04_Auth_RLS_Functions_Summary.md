# 04 — Auth, RLS & Functions Summary

## Аутентификация

### Метод
- Email + пароль через `supabase.auth.signInWithPassword()` (AdminLogin)
- Нет регистрации пользователей из UI — предполагается ручное создание в Supabase Dashboard

### Сессия
- `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`
- Кастомный `authStorage` с console-логированием операций
- `AdminRoute` слушает `onAuthStateChange` (кроме `INITIAL_SESSION`) + `getSession()` при монтировании

### Проверка ролей
- Функция `get_my_role()` (SQL, SECURITY DEFINER, `search_path = ''`)
- Возвращает `profile_role` enum из `profiles.role` для `auth.uid()`
- Используется в `AdminRoute` для проверки доступа
- Допустимые роли: `admin`, `operator`

### Logout
- `supabase.auth.signOut()` в AdminDashboard header
- Перенаправление на `/admin/login`

---

## RLS Policies

### Таблица `properties`

| Policy | Command | Roles | Условие |
|--------|---------|-------|---------|
| `admin_op_manage_properties` | ALL | authenticated | `get_my_role() IN ('admin', 'operator')` |
| `public_can_create_properties_safe` | INSERT | public (anon) | Строгие ограничения на payload: `status='new'`, `is_archived=false`, `payment_status IS NULL`, `payment_amount IS NULL`, `payment_receipt_url IS NULL`, `payment_comment IS NULL`, `selected_lead_id IS NULL`, `verification_checklist IS NULL` |

**Важно**: anon может INSERT, но НЕ SELECT. Поэтому `useCreateProperty` для публичного потока использует `.insert()` без `.select()`.

### Таблица `leads`

| Policy | Command | Roles | Условие |
|--------|---------|-------|---------|
| `admin_op_manage_leads` | ALL | authenticated | `get_my_role() IN ('admin', 'operator')` |
| `public can create leads` | INSERT | public (anon) | `WITH CHECK (true)` — без ограничений на payload |

**Важно**: anon может INSERT, но НЕ SELECT. `useCreateLead` использует `.insert()` без `.select()`.

### Таблица `profiles`

| Policy | Command | Roles | Условие |
|--------|---------|-------|---------|
| `users can read own profile` | SELECT | authenticated | `id = auth.uid()` |
| `admins can read all profiles` | SELECT | authenticated | `get_my_role() IN ('admin', 'operator')` |
| `users can update own profile safely` | UPDATE | authenticated | `id = auth.uid()` AND роль не меняется (`role = SELECT role FROM profiles WHERE id = auth.uid()`) |

**Ограничения**: INSERT и DELETE запрещены для всех.

### View `public_properties`
- Security definer view — работает с правами владельца
- Anon пользователи могут SELECT из view, но НЕ из базовой таблицы `properties`

---

## DB Functions

### `get_my_role()`
```sql
-- SQL, STABLE, SECURITY DEFINER, search_path = ''
SELECT role FROM public.profiles WHERE id = auth.uid()
```
- Возвращает `profile_role` enum
- Используется во всех RLS policies для проверки admin/operator

### `on_property_inserted()`
```
-- PL/pgSQL, SECURITY DEFINER, search_path = 'public'
-- AFTER INSERT trigger function
```
- Читает секрет `notify_webhook_secret` из `vault.decrypted_secrets`
- Формирует URL из `app.settings.supabase_url` или hardcoded fallback
- Вызывает `net.http_post()` к `/functions/v1/notify-new-property`
- Передаёт `row_to_json(NEW)` в body, секрет в `x-webhook-secret` header

### `on_lead_inserted()`
- Аналогична `on_property_inserted()`, но для таблицы `leads`
- Вызывает `/functions/v1/notify-new-lead`

### `set_updated_at()`
- Устанавливает `new.updated_at = now()` — используется как BEFORE UPDATE trigger

### `rls_auto_enable()`
- Event trigger на `CREATE TABLE` — автоматически включает RLS на новых таблицах в `public` схеме

---

## Модель безопасности — краткое резюме

1. **Роли хранятся отдельно** в таблице `profiles`, не в `auth.users`
2. **Privilege escalation предотвращена**: UPDATE policy для `profiles` запрещает изменение роли
3. **Анонимные пользователи** могут только INSERT в `properties` (с ограничениями) и `leads` (без ограничений)
4. **SELECT для анонимов** — только через `public_properties` view
5. **Admin/operator** — полный доступ к `properties` и `leads` через RLS с `get_my_role()`
6. **Edge Functions** защищены webhook secret, дополнительно проверяют существование записи в БД
7. **Не подтверждено по коду**: нет rate limiting на публичные INSERT операции (leads, properties)
