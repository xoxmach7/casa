# 03 — Auth, RLS & Functions Summary

---

## Аутентификация

### Метод
- Email + пароль через `supabase.auth.signInWithPassword()` (`AdminLogin`)
- Нет регистрации пользователей из UI — создание вручную в Supabase Dashboard

### Сессия (из `src/integrations/supabase/client.ts`)
- `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`
- Кастомный `authStorage` с console-логированием `getItem`/`setItem`/`removeItem`

### Route Guard (`AdminRoute`, строки 1–147)
- `onAuthStateChange` (пропускает `INITIAL_SESSION`) + `getSession()` при монтировании
- Параллельная защита от stale responses через `requestIdRef`
- Проверка роли: `supabase.rpc('get_my_role')` → проверка `['admin', 'operator']`
- Нет сессии → `/admin/login`
- Сессия есть, роль не подходит → `/`
- Логирование: все переходы состояний логируются через `console.info`/`console.warn`

### Logout
- `supabase.auth.signOut()` в `AdminDashboard` header (строка 70)
- Перенаправление на `/admin/login` с `replace: true`

---

## RLS Policies

### Таблица `properties`

| Policy | Command | Roles | USING | WITH CHECK |
|--------|---------|-------|-------|------------|
| `admin_op_manage_properties` | ALL | authenticated | `get_my_role() IN ('admin','operator')` | `get_my_role() IN ('admin','operator')` |
| `public_can_create_properties_safe` | INSERT | public (anon) | — | `status='new' AND is_archived=false AND payment_status IS NULL AND payment_amount IS NULL AND payment_receipt_url IS NULL AND payment_comment IS NULL AND selected_lead_id IS NULL AND verification_checklist IS NULL` |

**Следствия**:
- Anon может INSERT, но НЕ SELECT → `useCreateProperty` для публичного потока использует `.insert()` без `.select()`
- Payload должен явно устанавливать `payment_status: null`, `verification_checklist: null` и т.д. (подтверждено в `AddListing.tsx` строки 166-171)

### Таблица `leads`

| Policy | Command | Roles | USING | WITH CHECK |
|--------|---------|-------|-------|------------|
| `admin_op_manage_leads` | ALL | authenticated | `get_my_role() IN ('admin','operator')` | `get_my_role() IN ('admin','operator')` |
| `public can create leads` | INSERT | public (anon) | — | `true` |

**Следствия**:
- Anon может INSERT без ограничений на payload
- ⚠️ Нет ограничения на `status` — anon теоретически может вставить `status: 'in_deal'`
- `useCreateLead` использует `.insert()` без `.select()` для совместимости с anon

### Таблица `profiles`

| Policy | Command | Roles | USING | WITH CHECK |
|--------|---------|-------|-------|------------|
| `users can read own profile` | SELECT | authenticated | `id = auth.uid()` | — |
| `admins can read all profiles` | SELECT | authenticated | `get_my_role() IN ('admin','operator')` | — |
| `users can update own profile safely` | UPDATE | authenticated | `id = auth.uid()` | `id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid())` |

**Следствия**:
- INSERT и DELETE запрещены для всех
- UPDATE не может изменить `role` (WITH CHECK проверяет, что role не меняется)

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
- Используется во всех RLS policies admin/operator
- `search_path = ''` — защита от schema injection

### `on_property_inserted()` / `on_lead_inserted()`
- PL/pgSQL, SECURITY DEFINER, `search_path = 'public'`
- Предназначены как AFTER INSERT trigger functions
- Читают `notify_webhook_secret` из `vault.decrypted_secrets`
- URL: `app.settings.supabase_url` или hardcoded fallback
- Вызывают `net.http_post()` к соответствующей Edge Function
- При отсутствии секрета: `RAISE WARNING`, `RETURN NEW` (не блокируют INSERT)

### `set_updated_at()`
```sql
-- PL/pgSQL, обычный (не SECURITY DEFINER)
new.updated_at = now(); return new;
```
- BEFORE UPDATE trigger для автообновления `updated_at`

### `rls_auto_enable()`
- PL/pgSQL, EVENT TRIGGER, SECURITY DEFINER
- Автоматически включает RLS на новых таблицах в `public` схеме

---

## Модель безопасности — резюме

1. **Роли в отдельной таблице** (`profiles`), не в `auth.users` ✅
2. **Privilege escalation предотвращена**: UPDATE policy блокирует изменение `role` ✅
3. **Анонимные**: INSERT в `properties` (строгие ограничения) и `leads` (без ограничений) ✅
4. **Анонимный SELECT**: только `public_properties` view (security definer) ✅
5. **Admin/Operator**: полный CRUD через `get_my_role()` ✅
6. **Edge Functions**: webhook secret + DB verification ✅
7. **Нет rate limiting**: на публичные INSERT ❌
8. **Leads policy слишком открыта**: `WITH CHECK (true)` — нет проверки payload ⚠️
9. **Нет проверки**: что `property_id` в lead ссылается на существующую/опубликованную квартиру на уровне RLS ⚠️
