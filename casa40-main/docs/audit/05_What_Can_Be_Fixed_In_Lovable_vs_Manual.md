# 05 — What Can Be Fixed in Lovable vs Manual

> Разделение задач по тому, что можно исправить через Lovable (код + миграции), а что требует ручного вмешательства в Supabase Dashboard или внешних сервисах.

---

## ✅ Можно исправить в Lovable

### Код (фронтенд)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 1 | Заменить plain input на PhoneInput в AdminLeads inline edit | `AdminLeads.tsx:148-153` | Низкая |
| 2 | Заменить AdminEditableText на PhoneInput для seller_phone в AdminObjectCard | `AdminObjectCard.tsx:718` | Низкая |
| 3 | Добавить `validatePhone` в AdminAddObject перед submit | `AdminAddObject.tsx:120-122` | Низкая |
| 4 | Типизировать `SellerListingForm` (заменить `Record<string, any>`) | `AddListing.tsx:15` | Низкая |
| 5 | Разбить AdminObjectCard на подкомпоненты | `AdminObjectCard.tsx` (1013 строк) | Средняя |
| 6 | Вынести `formatPrice` из `PropertyCard` в утилиту | `PropertyCard.tsx`, `formatters.ts` | Низкая |
| 7 | Удалить неиспользуемые `Property`/`Lead` типы из `types/casa.ts` | `types/casa.ts` | Низкая |
| 8 | Добавить debounce на inline-обновления в AdminObjectCard | `AdminObjectCard.tsx:528,544,560,...` | Средняя |
| 9 | Добавить пагинацию в useAllProperties / useLeads | `useProperties.ts`, `useLeads.ts` | Средняя |
| 10 | Блокировать submit если фото не загружены | `AddListing.tsx` | Низкая |

### Миграции (БД через Lovable)

| # | Задача | Тип | Сложность |
|---|--------|-----|-----------|
| 11 | Ужесточить RLS для leads: `WITH CHECK (status = 'new')` | ALTER POLICY | Низкая |
| 12 | Создать DB triggers если не привязаны | CREATE TRIGGER | Низкая |
| 13 | Добавить `expected_timeline` constraint или validation trigger | ALTER TABLE / TRIGGER | Низкая |

### Edge Functions (через Lovable)

| # | Задача | Файл | Сложность |
|---|--------|------|-----------|
| 14 | Заменить sender `onboarding@resend.dev` на кастомный | `notify-new-property/index.ts`, `notify-new-lead/index.ts` | Низкая (после настройки домена в Resend) |

---

## 🔧 Требует ручной проверки / настройки в Dashboard

| # | Задача | Где | Как проверить |
|---|--------|-----|---------------|
| 1 | Проверить привязку DB triggers к таблицам | Supabase SQL Editor | `SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';` |
| 2 | Проверить pg_net расширение активно | Supabase SQL Editor | `SELECT * FROM pg_extension WHERE extname = 'pg_net';` |
| 3 | Проверить совпадение Vault secret и Edge Functions secret | Supabase Dashboard (Vault + Functions settings) | Сравнить значения |
| 4 | Проверить SQL view `public_properties` | Supabase SQL Editor | `SELECT pg_get_viewdef('public_properties', true);` |
| 5 | Проверить Storage bucket policies (upload/delete RLS) | Supabase Dashboard → Storage → Policies | Визуальная проверка |
| 6 | Проверить trigger на auth.users для создания profiles | Supabase SQL Editor | `SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = 'auth';` |
| 7 | Проверить domain restriction TomTom API key | TomTom Developer Portal | Проверить whitelist доменов |

---

## ❌ Требует работы вне Lovable

| # | Задача | Где | Описание |
|---|--------|-----|----------|
| 1 | Настроить кастомный email домен | Resend Dashboard | Верифицировать домен для отправки с кастомного адреса |
| 2 | Rate limiting на публичные формы | Supabase (Edge Functions / pg_net / external) | Нет встроенного решения в Lovable |
| 3 | SMS-верификация телефона продавца | External SMS provider | Интеграция с SMS-сервисом |
| 4 | Мониторинг количества данных | Supabase Dashboard | Отслеживать приближение к лимиту 1000 строк |

---

## Приоритетный план действий

### Немедленно (через Lovable)
1. ⬜ Проверить DB triggers (#12 из миграций, #1 из ручной проверки)
2. ⬜ Ужесточить RLS для leads (#11)
3. ⬜ Унифицировать PhoneInput (#1-3 из кода)

### В ближайшее время (через Lovable)
4. ⬜ Типизировать SellerListingForm (#4)
5. ⬜ Разбить AdminObjectCard (#5)
6. ⬜ Добавить пагинацию (#9)

### При возможности
7. ⬜ Debounce inline updates (#8)
8. ⬜ Очистка устаревших типов (#6, #7)
9. ⬜ Настроить кастомный email домен (вне Lovable)
