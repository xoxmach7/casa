# 02 — Feature & Screen Map

## Маршруты (из `src/App.tsx`)

| Маршрут | Компонент | Доступ | Описание |
|---------|-----------|--------|----------|
| `/` | `Index` (BuyerHome) | Публичный (anon) | Главная: слайдер бюджета, карта TomTom/Leaflet с ценовыми пинами, карточка квартиры, фильтры |
| `/property/:id` | `PropertyDetail` | Публичный (anon) | Детали квартиры: фото-галерея, планировка, характеристики, CTA |
| `/property/:id/request` | `ViewingRequest` | Публичный (anon) | Форма заявки на просмотр (имя + телефон KZ), создаёт `leads` |
| `/sell` | `SellLanding` | Публичный (anon) | Лендинг для продавцов: описание услуги, FAQ, контакты |
| `/sell/add` | `AddListing` | Публичный (anon) | Мультишаговая форма подачи объявления (4 шага), создаёт `properties` |
| `/sell/success` | `SellSuccess` | Публичный (anon) | Экран успеха после подачи объявления |
| `/admin/login` | `AdminLogin` | Публичный | Форма входа (email + пароль, Supabase Auth) |
| `/admin` | `AdminRoute` → `AdminDashboard` | Authenticated (admin/operator) | Дашборд: статистика, «Требует внимания», «Показы», «В сделке» |
| `/admin/objects` | `AdminObjects` | Authenticated | Список квартир с табами статусов, поиском, архивом |
| `/admin/objects/new` | `AdminAddObject` | Authenticated | Форма создания квартиры из админки |
| `/admin/objects/:id` | `AdminObjectCard` | Authenticated | Карточка квартиры: редактирование, заявки, статус-переходы, фото, чеклист, оплата, карта, архив |
| `/admin/leads` | `AdminLeads` | Authenticated | Список заявок с табами, поиском, inline-редактированием |
| `/admin/leads/new` | `AdminAddLead` | Authenticated | Форма создания заявки из админки |
| `*` | `NotFound` | Публичный | 404 |

## Ключевые компоненты

| Компонент | Файл | Назначение |
|-----------|------|------------|
| `PhoneInput` | `src/components/PhoneInput.tsx` | Единый ввод телефона KZ с маской `+7 (7XX) XXX-XX-XX` |
| `PropertyCard` | `src/components/PropertyCard.tsx` | Карточка квартиры, экспортирует `formatPrice` |
| `PublicMap` | `src/components/PublicMap.tsx` | Leaflet-карта с TomTom-тайлами и ценовыми пинами |
| `AdminPropertyMap` | `src/components/AdminPropertyMap.tsx` | Leaflet-карта в админке с кликом для координат |
| `FilterSheet` | `src/components/FilterSheet.tsx` | Bottom-sheet фильтров: район, комнаты, площадь, планировка |
| `PhotoGallery` | `src/components/PhotoGallery.tsx` | Полноэкранная галерея фото |
| `TrustLabel` | `src/components/TrustLabel.tsx` | Аккордеон-пилюля «Проверенная квартира» / «Помощь CASA» |
| `StatusBadge` | `src/components/StatusBadge.tsx` | Бейдж статуса (Новая, Опубликован, Показ, В сделке) |
| `DocChecklist` | `src/components/DocChecklist.tsx` | Чеклист документов (Техпаспорт, Договор, Уведомление, Форма 2) |
| `CasaHeader` | `src/components/CasaHeader.tsx` | Хедер с вариантами (`home`, `form`, `sell`, `admin`, `property`) |
| `AdminRoute` | `src/components/AdminRoute.tsx` | Route guard: сессия + роль через `get_my_role()` RPC |

## Статусные переходы (по коду `AdminObjectCard.handleCTA`)

```
properties: new → published → showing → in_deal → (payment)
leads:      new → showing → in_deal
```

Переходы инициируются CTA-кнопкой. Для `published → showing` и `showing → in_deal` требуется выбор заявки.

## Формы с полем телефона

| Форма | Компонент `PhoneInput` | Валидация `validatePhone` | Нормализация `parsePhoneRaw` |
|-------|------------------------|---------------------------|------------------------------|
| ViewingRequest | ✅ | ✅ | ✅ |
| AddListing (Step 4) | ✅ | ✅ | ✅ |
| AdminAddObject | ✅ | ❌ (проверяет только `canSubmit`) | ✅ |
| AdminAddLead | ✅ | ✅ | ✅ |
| AdminLeads (inline edit) | ❌ (plain input) | ❌ | ❌ |
| AdminObjectCard (seller phone edit) | ❌ (plain input) | ❌ | ❌ |

## Данные

| Хук | Таблица/View | Доступ |
|-----|-------------|--------|
| `usePublishedProperties` | `public_properties` (view) | anon |
| `usePublicProperty` | `public_properties` (view) | anon |
| `useAllProperties` | `properties` | authenticated (admin/operator) |
| `useProperty` | `properties` | authenticated (admin/operator) |
| `useCreateProperty` | `properties` INSERT | anon/authenticated |
| `useUpdateProperty` | `properties` UPDATE | authenticated (admin/operator) |
| `useLeads` | `leads` SELECT | authenticated (admin/operator) |
| `useLeadsByProperty` | `leads` SELECT filtered | authenticated (admin/operator) |
| `useCreateLead` | `leads` INSERT | anon/authenticated |
| `useUpdateLead` | `leads` UPDATE | authenticated (admin/operator) |
