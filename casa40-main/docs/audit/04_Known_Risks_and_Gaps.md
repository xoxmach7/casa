# 04 — Known Risks & Gaps

> Все пункты подтверждены по коду, если не указано иное.

---

## 🔴 Высокий приоритет

### 1. Нет rate limiting на публичные формы
- **Риск**: Анонимный пользователь может создавать неограниченное количество leads и properties
- **Подтверждено**: RLS policy `public can create leads` — `WITH CHECK (true)`, RLS policy `public_can_create_properties_safe` — ограничивает payload, но не частоту
- **Рекомендация**: Rate limiting через Edge Function middleware или Supabase custom claims

### 2. Leads INSERT policy не ограничивает payload
- **Риск**: Anon может вставить lead с `status: 'in_deal'` или произвольным `property_id`
- **Подтверждено**: `WITH CHECK (true)` — единственное условие
- **Сравнение**: Policy для properties строго ограничивает payload, для leads — нет
- **Рекомендация**: Добавить `WITH CHECK (status = 'new')` и/или FK constraint enforcement

### 3. DB triggers — статус привязки не подтверждён
- **Риск**: Если triggers не привязаны к таблицам — email-уведомления не работают
- **Подтверждено**: API `<db-triggers>` показывает "There are no triggers", хотя функции существуют
- **Рекомендация**: Проверить через SQL (см. 05_What_Can_Be_Fixed)

---

## 🟡 Средний приоритет

### 4. Телефон в inline-редактировании не использует PhoneInput
- **Подтверждено**: `AdminLeads.tsx` строки 148-153 — plain `<input>` для `buyer_phone`
- **Подтверждено**: `AdminObjectCard.tsx` строка 718 — `AdminEditableText` для `seller_phone`
- **Результат**: Нет маски, нет валидации, нет нормализации при inline-редактировании
- **Рекомендация**: Заменить на PhoneInput или добавить нормализацию перед сохранением

### 5. AdminObjectCard — 1013 строк в одном компоненте
- **Подтверждено**: `src/pages/AdminObjectCard.tsx` — 1013 строк
- **Риск**: Сложность поддержки, высокая связность
- **Рекомендация**: Разбить на подкомпоненты (LeadSection, SellerSection, PhotoSection, PaymentSheet)

### 6. Тип `SellerListingForm = Record<string, any>`
- **Подтверждено**: `AddListing.tsx` строка 15
- **Риск**: Ошибки типов не отлавливаются компилятором
- **Рекомендация**: Создать типизированный интерфейс

### 7. Нет пагинации
- **Подтверждено**: `useAllProperties`, `useLeads` — `select('*')` без limit/offset
- **Риск**: Supabase default limit 1000 строк, при росте данных результаты обрежутся
- **Рекомендация**: Добавить пагинацию или `.range()`

### 8. Inline обновления без debounce
- **Подтверждено**: `AdminObjectCard.tsx` строки 528, 544, 560, 593-598, 627, 655, 681 — прямые `supabase.from('leads').update()` в onChange handlers
- **Риск**: Избыточная нагрузка на базу при быстром переключении
- **Рекомендация**: Добавить debounce или save-on-blur

### 9. TomTom API ключ в клиентском коде
- **Подтверждено**: `src/data/constants.ts` строка 4 — hardcoded ключ
- **Смягчение**: Комментарий "domain-whitelisted, safe for client bundle"
- **Риск**: Если домен не ограничен — ключ может использоваться третьими лицами
- **Рекомендация**: Проверить domain restriction в TomTom Portal

---

## 🟢 Низкий приоритет

### 10. PropertyCard компонент не используется в рендеринге
- **Подтверждено**: `PropertyCard` принимает `Property` (camelCase из `types/casa.ts`), но данные приходят в snake_case. Используется только экспорт `formatPrice`
- **Рекомендация**: Удалить компонент, вынести `formatPrice` в утилиту

### 11. Тип `Property` в `types/casa.ts` устарел
- **Подтверждено**: CamelCase интерфейс не соответствует DB-схеме (snake_case). Используется только в `PropertyCard`
- **Рекомендация**: Удалить или привести в соответствие с DB

### 12. Нет удаления квартир и заявок
- **Подтверждено**: Только архивирование (`is_archived`) для properties, нет UI для удаления leads
- **Рекомендация**: Добавить hard delete или soft delete для leads

### 13. Нет верификации продавца
- **Подтверждено**: Форма `/sell/add` не требует аутентификации, email или SMS-подтверждения
- **Рекомендация**: Добавить хотя бы SMS-верификацию телефона

### 14. Нет обработки ошибок загрузки фото в public flow
- **Подтверждено**: `AddListing.tsx` строки 203-216 — ошибка upload показывает toast, но цикл продолжается, форма не блокируется
- **Рекомендация**: Блокировать submit если фото не загружены

### 15. Resend sender — sandbox адрес
- **Подтверждено**: Edge Functions используют `from: "CASA <onboarding@resend.dev>"`
- **Риск**: Ограничения Resend на sandbox домен, письма могут попадать в спам
- **Рекомендация**: Настроить кастомный домен в Resend

### 16. AdminAddObject не использует validatePhone
- **Подтверждено**: `AdminAddObject.tsx` строка 120 — `canSubmit` проверяет только наличие `form.sellerPhone`, не вызывает `validatePhone`
- **Рекомендация**: Добавить вызов `validatePhone` перед submit
