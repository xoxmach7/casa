# 01 — Project Summary (Current State)

> Актуальный снимок проекта по состоянию кода на апрель 2026.
> Не дублирует CASA_MVP_Spec.md и CASA_MVP_Handoff_v2.docx — дополняет их фактическим состоянием.

## Общие сведения

| Параметр | Значение |
|----------|----------|
| Название | CASA |
| Назначение | Платформа купли-продажи квартир в Астане |
| Published URL | https://casa40.lovable.app |
| Supabase ref | `rekpjnncrvctaxymqxpn` |
| Язык UI | Русский (единственный) |
| Валюта | Тенге (₸) |

## Стек (подтверждён по `package.json`)

| Слой | Технологии |
|------|------------|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3 |
| UI | shadcn/ui (Radix), Framer Motion, Lucide Icons, Recharts |
| Карты | Leaflet + react-leaflet + TomTom raster tiles |
| State | TanStack React Query v5 |
| Routing | React Router DOM v6 |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Email | Resend API (через Edge Functions) |
| Формы | react-hook-form + zod (установлены, но формы используют useState) |

## Архитектура

- **SPA** — client-side only, без SSR
- **Mobile-first** — дизайн ориентирован на мобильные экраны
- **Auth**: email + пароль (только для админов/операторов)
- **Анонимный доступ**: покупатели и продавцы работают без авторизации
- **Уведомления**: DB trigger → pg_net → Edge Function → Resend API (fire-and-forget)

## Маршруты (из `src/App.tsx`)

### Публичные (anon)
| Путь | Компонент | Назначение |
|------|-----------|------------|
| `/` | `Index` | Главная: бюджет-слайдер, карта, карточки квартир |
| `/property/:id` | `PropertyDetail` | Детали квартиры |
| `/property/:id/request` | `ViewingRequest` | Заявка на просмотр |
| `/sell` | `SellLanding` | Лендинг для продавцов |
| `/sell/add` | `AddListing` | Форма подачи объявления (4 шага) |
| `/sell/success` | `SellSuccess` | Успех подачи |
| `/admin/login` | `AdminLogin` | Вход для админов |

### Защищённые (admin/operator через `AdminRoute`)
| Путь | Компонент | Назначение |
|------|-----------|------------|
| `/admin` | `AdminDashboard` | Дашборд: статистика, требует внимания |
| `/admin/objects` | `AdminObjects` | Список квартир с табами статусов |
| `/admin/objects/new` | `AdminAddObject` | Создание квартиры |
| `/admin/objects/:id` | `AdminObjectCard` | Полная карточка: редактирование, статусы, оплата |
| `/admin/leads` | `AdminLeads` | Список заявок с inline-редактированием |
| `/admin/leads/new` | `AdminAddLead` | Создание заявки |

## Supabase-ресурсы (подтверждены)

### Таблицы
- `properties` — квартиры (enum `property_status`: new, published, showing, in_deal)
- `leads` — заявки покупателей (enum `lead_status`: new, showing, in_deal)
- `profiles` — роли пользователей (enum `profile_role`: admin, operator, user)

### Views
- `public_properties` — security definer view, фильтрует и скрывает PII

### Storage Buckets
- `property-photos` (public) — фото квартир
- `floor-plans` (public) — планировки
- `payment-receipts` (private) — чеки оплаты

### Edge Functions
- `notify-new-property` — email при новой квартире
- `notify-new-lead` — email при новой заявке

### DB Functions
- `get_my_role()` — роль текущего пользователя (SECURITY DEFINER)
- `on_property_inserted()` — trigger function для webhook
- `on_lead_inserted()` — trigger function для webhook
- `set_updated_at()` — trigger для updated_at
- `rls_auto_enable()` — event trigger для RLS

## Бизнес-модель (по коду)

- Комиссия: **200 000 ₸** за покупателя (подтверждено: `SellLanding`, `AdminObjectCard` default payment amount)
- Оплата: только при успешной сделке через CASA

## Контакты (по коду)

- Телефон: `8 707 503 71 60` (Footer компонент на `/`, страница `/sell`)
- WhatsApp: `https://wa.me/77075037160`

## Стандарт телефона

- Компонент: `PhoneInput` (`src/components/PhoneInput.tsx`)
- Маска: `+7 (7XX) XXX-XX-XX`
- Нормализация: `parsePhoneRaw()` → `+77XXXXXXXXX`
- Валидация: `validatePhone()` / `isPhoneComplete()`
- Используется в: ViewingRequest, AddListing, AdminAddObject, AdminAddLead
- **Не используется в**: AdminLeads (inline edit), AdminObjectCard (seller phone edit)

## Env-переменные (только имена)

### Клиентские (`.env`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Edge Functions secrets (Supabase Dashboard)
- `RESEND_API_KEY`, `ALERT_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFY_WEBHOOK_SECRET`

### Hardcoded (в коде)
- TomTom API key в `src/data/constants.ts` (domain-whitelisted по комментарию)

## Миграции

16 файлов в `supabase/migrations/` (2026-03-19 — 2026-04-07). Read-only.
