# CASA Pro Ипотека — карта аналитических событий (Phase 0)

Источник: `CASA_Pro_Ipoteka_Project_Spec_v1.1.json` → `analytics` + `events`.
На Phase 0 события только объявлены (карта + точки вызова в UI); отправка в
аналитику подключается в Phase 1+.

## Продуктовые события (аналитика воронки)

| Событие | Когда шлётся (точка в UI) | Ключевые свойства |
|---|---|---|
| `mortgage_workspace_opened` | Монтирование `/dashboard/mortgage` | `actor_id`, `tenant_id` |
| `client_created` | Создан клиент в `ClientPickerModal` | `client_id`, `source: picker\|new` |
| `consent_sent` | «Отправить SMS-согласие» (`ConsentModal`) | `client_id`, `consent_id`, `method` |
| `consent_confirmed` | Клиент подтвердил согласие | `consent_id`, `elapsed_ms` |
| `document_uploaded` | Старт загрузки PDF (секция 2) | `document_type`, `client_id` |
| `document_confirmed` | Подтверждение полей документа | `document_type`, `manual_corrections` |
| `analysis_run` | «Запустить анализ» (секция 3) | `analysis_id`, `snapshot_id` |
| `scenario_applied` | Выбор сценария (секция 4) | `scenario_type`, `rank`, `preliminary` |
| `what_if_changed` | Изменение любого поля (секция 5, дебаунс) | `field`, `kdn`, `eligible_programs` |
| `property_added_to_selection` | «Добавить в подборку» (секция 6) | `property_unit_id`, `fit_status` |
| `conclusion_generated` | «Сформировать PDF» (секция 7) | `conclusion_id`, `version` |
| `conclusion_shared` | «Создать ссылку» (секция 7) | `conclusion_id`, `link_expires_at` |

## Воронка (analytics.funnel)

```
workspace_opened
  → real_client_created
    → consent_confirmed
      → two_documents_confirmed
        → analysis_completed
          → scenario_selected
            → property_selection_created
              → conclusion_shared
```

## Доменные события (шина, для интеграций/уведомлений)

`client.created`, `consent.requested`, `consent.opened`, `consent.confirmed`,
`consent.rejected`, `consent.expired`, `consent.revoked`, `document.uploaded`,
`document.processing_started`, `document.needs_review`, `document.confirmed`,
`iin_check.completed`, `client_snapshot.confirmed`, `analysis.completed`,
`program_option.appeared`, `program_option.disappeared`, `scenario.generated`,
`scenario.selected`, `property_match.created`, `property_availability.stale`,
`conclusion.shared`.

## Приватность в аналитике

Маскируются/не логируются: `iin`, `phone`, `document_text`, `otp` (см.
`security_and_privacy.logging`). В свойства событий кладём `client_id` (не ИИН),
маскированный телефон и хэши — не сырые персональные данные.
