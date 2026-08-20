# CASA Pro Ипотека — Phase 1 «Согласие, документы и данные»

Источник: `CASA_Pro_Ipoteka_Project_Spec_v1.1.json` → `implementation_phases[1]`.
**Exit criteria:** реальный клиент даёт согласие; два PDF превращаются в
подтверждённый снимок с трассировкой полей.

## Юридический шлюз (важно)

Часть deliverables Phase 1 в самом ТЗ заблокирована `open_decisions` — их
закрывают люди вне разработки, кодом это не решается:

| OD | Владелец | Блокирует |
|---|---|---|
| OD-001 | legal | боевое согласие (достаточный способ подтверждения) |
| OD-002 | legal+security | где хранить PII, трансграничность |
| OD-003 | engineering | выбор SMS-провайдера + резервный канал |
| OD-004 | data+legal | официальные каналы АИС ОИП / КГД |
| OD-007 | legal+product | сроки хранения документов/согласий/аудита |

Поэтому Phase 1 ведём **двумя треками**: production-safe (строим сейчас) и
gated (готовим интерфейс, включаем после закрытия OD).

## Треки и статус

### A. Защищённая страница согласия — `secure_consent_page` ✅ (demo-safe, сделано)
- Публичный роут `app/consent/[token]/page.tsx`, мобильный.
- Механика OTP настоящая; SMS-доставка заглушена (код показан на экране) — OD-003.
- Из рабочего экрана специалист открывает «страницу клиента (демо)».

### B. Бэкенд согласия — `consent_audit` (следующий инкремент, production-safe)
- Роуты `/api/mortgage/consents` (специалист) + `/api/public/mortgage-consent/:token` (клиент).
- Переиспользовать `ClientConsent`/`ConsentRevision` (Foundation уже в схеме);
  добавить поля токена (hash), OTP (hash+ttl+attempts), статуса из `consent.status_enum`,
  аудит-метаданные. Миграция + schema (правило: прод `db push`, CI `migrate deploy`).
- OTP настоящий, доставка SMS — заглушка с честным «не доставлено» (как SpecTra),
  до OD-003. Rate limits из `consent.request`.

### C. Загрузка и обработка документов — `encrypted_document_storage`, `*_extraction`
- Загрузка PDF через существующий `/api/upload` (MinIO) — но для реального PII
  storage-политику подтверждает OD-002; пока demo-bucket без реального PII.
- Конвейер `document_processing.pipeline`: mime/подпись → antivirus → classify →
  extract → confidence → inconsistencies → manual review → confirm → snapshot.
- Извлечение полей `credit_history`/`enpf_statement` с `field_provenance` (страница,
  хэш фрагмента, версия экстрактора, уверенность). На старте — стаб-экстрактор с
  фиксированными демо-полями, интерфейс под реальный парсер.

### D. Проверки по ИИН — `authorized_iin_connector_framework` (gated OD-004)
- Только каркас коннекторов (`aisoip`, `kgd_public_services`) с
  `production_status: integration_and_legal_review_required`. По умолчанию
  возвращает `not_authorized` / `source_unavailable` (никогда не выдаёт
  «записей нет» при отказе источника — AC-015). Реальные вызовы — после OD-004.

### E. Ручная проверка — `manual_review_ui` ✅ (каркас в Phase 0)
- Таблица полей + правка низкой уверенности уже в секции 2; свяжется с B/C.

## Порядок работ

1. B — бэкенд согласия (demo-safe) + подключить страницу A к нему.
2. C — стаб-загрузка + стаб-экстрактор + снимок с провенансом.
3. D — каркас коннекторов ИИН.
4. Свести exit criteria: клиент даёт согласие (demo) → два PDF → подтверждённый снимок.

Реальные SMS/PII/ИИН включаются отдельными задачами по мере закрытия OD-001..007.
