# 01 — Current Feature & Screen Map

> Полная карта маршрутов, экранов и компонентов по текущему коду.

## Маршруты (из `src/App.tsx`)

### Публичные (anon)

| Путь | Компонент | Файл | Назначение |
|------|-----------|------|------------|
| `/` | `Index` (BuyerHome) | `src/pages/Index.tsx` | Главная: слайдер бюджета (10–80M, шаг 1M, default 50M), карта Leaflet/TomTom с ценовыми пинами, карточка квартиры, фильтры (район, комнаты, площадь, планировка) |
| `/property/:id` | `PropertyDetail` | `src/pages/PropertyDetail.tsx` | Детали квартиры: фото-галерея (4:3), планировка (SVG placeholder если нет), характеристики, trust-пилюли, advantage-чипы, описание |
| `/property/:id/request` | `ViewingRequest` | `src/pages/ViewingRequest.tsx` | Форма заявки: имя + телефон (PhoneInput), создаёт lead в БД (anon INSERT) |
| `/sell` | `SellLanding` | `src/pages/SellLanding.tsx` | Лендинг продавца: описание услуги, 200K ₸ за покупателя, FAQ (4 вопроса), контакты |
| `/sell/add` | `AddListing` | `src/pages/AddListing.tsx` | 4-шаговая форма подачи: локация/цена → характеристики → фото → контакт |
| `/sell/success` | `SellSuccess` | `src/pages/SellSuccess.tsx` | Экран успеха после подачи |
| `/admin/login` | `AdminLogin` | `src/pages/AdminLogin.tsx` | Email + пароль через Supabase Auth |
| `*` | `NotFound` | `src/pages/NotFound.tsx` | 404 |

### Защищённые (через `AdminRoute`, требуется `admin`/`operator` роль)

| Путь | Компонент | Файл | Назначение |
|------|-----------|------|------------|
| `/admin` | `AdminDashboard` | `src/pages/AdminDashboard.tsx` | Дашборд: 4 стата (Квартиры/Заявки/Показы/Сделка), «Требует внимания» (новые заявки, ожидают публикации), навигация, logout |
| `/admin/objects` | `AdminObjects` | `src/pages/AdminObjects.tsx` | Список квартир: 6 табов (Все/Новая/Опубликован/Показ/В сделке/Архив), поиск по адресу/району, подсчёт заявок, action line |
| `/admin/objects/new` | `AdminAddObject` | `src/pages/AdminAddObject.tsx` | Создание квартиры: все поля, PhoneInput для телефона |
| `/admin/objects/:id` | `AdminObjectCard` | `src/pages/AdminObjectCard.tsx` (1013 строк) | Полная карточка: редактирование, заявки с выбором, статус-переходы, viewing datetime, финансирование, чеклист документов, карта с координатами, фото, описание, оплата, архив |
| `/admin/leads` | `AdminLeads` | `src/pages/AdminLeads.tsx` | Список заявок: 4 таба (Все/Новая/Показ/В сделке), поиск по имени/телефону, inline-редактирование (plain input для телефона) |
| `/admin/leads/new` | `AdminAddLead` | `src/pages/AdminAddLead.tsx` | Создание заявки: имя, телефон (PhoneInput), выбор квартиры (published/showing), комментарий |

---

## Ключевые компоненты

| Компонент | Файл | Назначение |
|-----------|------|------------|
| `PhoneInput` | `src/components/PhoneInput.tsx` | Единый ввод телефона KZ с маской `+7 (7XX) XXX-XX-XX`, `inputMode="tel"` |
| `PublicMap` | `src/components/PublicMap.tsx` | Leaflet карта + TomTom тайлы, ценовые пины с active/inactive состоянием |
| `AdminPropertyMap` | `src/components/AdminPropertyMap.tsx` | Leaflet карта для админки, клик для установки координат |
| `FilterSheet` | `src/components/FilterSheet.tsx` | Bottom-sheet фильтров: район (с подсчётом), комнаты, площадь, изолированные комнаты |
| `PhotoGallery` | `src/components/PhotoGallery.tsx` | Полноэкранная галерея фото |
| `TrustLabel` | `src/components/TrustLabel.tsx` | Аккордеон-пилюля (проверенная квартира / помощь CASA) |
| `StatusBadge` | `src/components/StatusBadge.tsx` | Бейдж статуса (Новая/Опубликован/Показ/В сделке) |
| `DocChecklist` | `src/components/DocChecklist.tsx` | Чеклист: Техпаспорт, Договор, Уведомление о госрегистрации, Форма 2 |
| `CasaHeader` | `src/components/CasaHeader.tsx` | Хедер с вариантами (home/form/sell/admin/property) |
| `AdminRoute` | `src/components/AdminRoute.tsx` | Route guard: сессия + роль через `get_my_role()` RPC |
| `PropertyCard` | `src/components/PropertyCard.tsx` | Экспортирует `formatPrice`; сам компонент принимает `Property` (camelCase) — **не используется в рендеринге** |

---

## Статусные переходы (по коду `AdminObjectCard.handleCTA`)

```
properties: new → published → showing → in_deal → (payment confirmation)
leads:      new → showing → in_deal
```

- `new → published`: CTA "Опубликовать", без условий
- `published → showing`: CTA "Показ подтверждён", требуется `selectedLeadId`
- `showing → in_deal`: CTA "В сделку", требуется `selectedLeadId`
- `in_deal → paid`: CTA "Оплата" → bottom sheet (сумма, чек, комментарий)
- Archived → "Восстановить из архива"

---

## Формы с полем телефона

| Форма | Файл | `PhoneInput` | `validatePhone` | `parsePhoneRaw` |
|-------|------|-------------|----------------|----------------|
| ViewingRequest | `ViewingRequest.tsx` | ✅ | ✅ | ✅ |
| AddListing (Step 4) | `AddListing.tsx` | ✅ | ✅ | ✅ |
| AdminAddObject | `AdminAddObject.tsx` | ✅ | ❌ (`canSubmit` check only) | ✅ |
| AdminAddLead | `AdminAddLead.tsx` | ✅ | ✅ | ✅ |
| AdminLeads (inline) | `AdminLeads.tsx:148-153` | ❌ plain `<input>` | ❌ | ❌ |
| AdminObjectCard (seller) | `AdminObjectCard.tsx:718` | ❌ `AdminEditableText` | ❌ | ❌ |

---

## Data Hooks (из `src/hooks/`)

| Хук | Таблица/View | Метод | Доступ |
|-----|-------------|-------|--------|
| `usePublishedProperties` | `public_properties` | SELECT | anon |
| `usePublicProperty(id)` | `public_properties` | SELECT + eq | anon |
| `useAllProperties` | `properties` | SELECT | authenticated |
| `useProperty(id)` | `properties` | SELECT + eq | authenticated |
| `useCreateProperty` | `properties` | INSERT (no `.select()` for anon) | anon / authenticated |
| `useUpdateProperty` | `properties` | UPDATE + `.select().single()` | authenticated |
| `useLeads` | `leads` | SELECT | authenticated |
| `useLeadsByProperty(id)` | `leads` | SELECT + eq | authenticated |
| `useCreateLead` | `leads` | INSERT (no `.select()`) | anon / authenticated |
| `useUpdateLead` | `leads` | UPDATE + `.select().single()` | authenticated |
