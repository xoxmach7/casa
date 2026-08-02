# 01 — Project Summary

## Название
CASA — платформа для покупки и продажи квартир в Астане (Казахстан).

## Стек
- **Frontend**: React 18, Vite 5, TypeScript 5, Tailwind CSS 3
- **UI-библиотеки**: shadcn/ui (Radix), Framer Motion, Lucide Icons, Recharts
- **Карты**: Leaflet + TomTom Tile API (ключ доменно-ограничен, хардкод в `src/data/constants.ts`)
- **Бэкенд**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email-уведомления**: Resend API (через Edge Functions, fire-and-forget, DB triggers)
- **Состояние**: TanStack React Query
- **Маршрутизация**: React Router DOM v6

## Supabase Project
- Ref: `rekpjnncrvctaxymqxpn`
- URL: `https://rekpjnncrvctaxymqxpn.supabase.co`
- Published: `https://casa40.lovable.app`

## Целевая аудитория
- **Покупатели** (анонимные): просмотр квартир на карте, фильтрация, запись на просмотр
- **Продавцы** (анонимные): подача объявления о продаже квартиры
- **Операторы/Админы** (аутентифицированные): управление объектами, заявками, статусами, оплатой

## Языки интерфейса
Русский (единственный).

## Бизнес-модель (по коду)
Комиссия 200 000 ₸ за покупателя, оплата только при успешной сделке через CASA (указано на `/sell` и в Step 4 формы `/sell/add`).

## Контакты (по коду)
- Телефон: `8 707 503 71 60` (Footer на `/`, страница `/sell`)
- WhatsApp: `https://wa.me/77075037160`
