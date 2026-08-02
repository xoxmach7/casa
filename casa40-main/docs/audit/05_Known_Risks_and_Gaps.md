# 05 — Known Risks & Gaps

## Безопасность

### 1. Нет rate limiting на публичные формы
- **Риск**: Анонимный пользователь может создавать неограниченное количество заявок (`leads`) и объявлений (`properties`)
- **Подтверждено по коду**: RLS policy `public can create leads` имеет `WITH CHECK (true)` без ограничений
- **Рекомендация**: Добавить rate limiting через Supabase Edge Function или middleware

### 2. Leads INSERT policy слишком открыта
- **Риск**: `public can create leads` позволяет anon вставлять произвольные данные (любой `property_id`, любой `status`)
- **Подтверждено по коду**: `WITH CHECK (true)` — единственное ограничение
- **Сравнение**: Policy для `properties` строго ограничивает payload (`public_can_create_properties_safe`), а для `leads` — нет
- **Рекомендация**: Добавить `WITH CHECK (status = 'new')` и проверку существования `property_id`

### 3. TomTom API ключ в клиентском коде
- **Факт**: Ключ `40nH6NdVknh4cEQN9bAO3MI2rNiek0y7` hardcoded в `src/data/constants.ts`
- **Смягчение**: По комментарию в коде — "domain-whitelisted, safe for client bundle"
- **Риск**: Если домен не ограничен в настройках TomTom, ключ может быть использован третьими лицами

### 4. Webhook secret в Vault
- **Факт**: Secret `notify_webhook_secret` хранится в Vault и читается DB functions
- **Подтверждено по коду**: Функции `on_property_inserted` и `on_lead_inserted` корректно читают из `vault.decrypted_secrets`
- **Риск**: Если значение в Vault не совпадает со значением в Edge Functions secrets — уведомления не будут работать

### 5. Inline обновления без debounce
- **Факт**: В `AdminObjectCard` некоторые обновления (viewing_datetime, financing) отправляются в БД при каждом изменении без debounce
- **Подтверждено по коду**: Строки 528, 544, 560, 593-598, 627, 655, 681 — прямые вызовы `supabase.from('leads').update()` в onChange handlers
- **Риск**: Избыточная нагрузка на базу при быстром взаимодействии

---

## Качество кода

### 6. Телефон в inline-редактировании не использует PhoneInput
- **Факт**: `AdminLeads` (строки 148-153) и `AdminObjectCard` (seller phone edit) используют plain `<input>` для телефона
- **Результат**: Нет маски, нет валидации, нет нормализации при inline-редактировании
- **Подтверждено по коду**: `AdminLeads` строка 150: `onChange={e => setVal('buyer_phone', e.target.value)}`

### 7. Тип `SellerListingForm` = `Record<string, any>`
- **Факт**: `AddListing` использует `Record<string, any>` вместо типизированной формы
- **Подтверждено по коду**: Строка 15: `type SellerListingForm = Record<string, any>`
- **Риск**: Ошибки типов не отлавливаются компилятором

### 8. AdminObjectCard — 1013 строк
- **Факт**: Один компонент содержит всю логику карточки квартиры
- **Риск**: Сложность поддержки, высокая связность

### 9. PropertyCard компонент не используется
- **Факт**: `PropertyCard` экспортирует `formatPrice`, но сам компонент использует старый тип `Property` из `types/casa.ts`, а не DB-тип
- **Подтверждено по коду**: `PropertyCard` принимает `Property` с camelCase полями, а реальные данные в snake_case
- **Результат**: Компонент `PropertyCard` фактически не рендерится нигде (используется только `formatPrice`)

### 10. Тип `Property` в `types/casa.ts` устарел
- **Факт**: Определяет camelCase-интерфейс, который не совпадает с DB-схемой (snake_case)
- **Подтверждено по коду**: Тип используется только в `PropertyCard`, который не используется в текущих экранах

---

## Функциональные пробелы

### 11. Нет удаления квартиры
- **Факт**: Есть архивирование (`is_archived`), но нет hard delete
- **Подтверждено по коду**: Только `handleArchive` в AdminObjectCard

### 12. Нет удаления заявок
- **Факт**: Нет UI для удаления leads
- **Подтверждено по коду**: Нет кнопки/действия удаления

### 13. Нет пагинации
- **Факт**: Все properties и leads загружаются одним запросом
- **Подтверждено по коду**: `useAllProperties`, `useLeads` — `select('*')` без limit/offset
- **Риск**: При росте данных возможен лимит Supabase (1000 строк по умолчанию)

### 14. DB triggers — статус неопределён
- **Факт**: В `<db-triggers>` указано "There are no triggers in the database", но функции trigger существуют
- **Требует ручной проверки**: Если триггеры не привязаны — email-уведомления не работают

### 15. Нет обработки ошибок загрузки фото в public flow
- **Факт**: В `AddListing` ошибка upload показывает toast, но не блокирует отправку формы
- **Подтверждено по коду**: Ошибка в `handlePhotoSelect` показывает toast, цикл продолжается

### 16. Нет подтверждения email / верификации продавца
- **Факт**: Продавец подаёт форму анонимно, без верификации email или телефона
- **Подтверждено по коду**: Форма `/sell/add` не требует аутентификации
