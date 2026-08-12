# Деплой crm (frontend) на Railway

Сервис `crm` в проекте `pro-casa-backend` собирается из этого каталога
(`delivery/frontend`, Root Directory) по `Dockerfile`, авто-деплой на push в
`master` с гейтом **«Wait for CI»**.

## ⚠️ Главная причина «прод не обновляется при пуше»

Гейт «Wait for CI» смотрит на **весь check-suite коммита в GitHub**, а не только
на статус самого воркфлоу. Если **любой** check-run падает, Railway помечает
деплой `SKIPPED` с `skippedReason: "CI check suite failed"` — и прод остаётся на
старой сборке. Проверить причину скипа:

```
railway deployment list -s crm         # верхний SKIPPED?
gh api repos/xoxmach7/casa/commits/<sha>/check-runs \
  --jq '.check_runs[]|{name,conclusion}'
```

Реальный инцидент 2026-08-12: правка редиректа в `components/login-form.tsx`
сломала юнит-тест `components/login-form.test.tsx`, из-за чего check-run
**«Frontend (typecheck + unit + build)» = failure**, и crm НЕ деплоился на
протяжении пяти коммитов подряд, хотя «сам CI» казался зелёным. Лечение —
починить тест; как только check-suite зелёный, авто-деплой проходит.

**Вывод: держите фронтовые тесты зелёными.** `npx vitest run` перед пушем.
Проваленный тест = прод не обновится, молча.

## watchPatterns

В [`railway.json`](./railway.json) заданы явные
`watchPatterns: ["delivery/frontend/**"]` (относительно корня репозитория), и то
же значение выставлено в настройках сервиса. Это не относится к инциденту выше
(тот был про CI-гейт), но делает детект изменений детерминированным: пересборка
crm триггерится на любое изменение под `delivery/frontend`.

## Ручной форс-деплой (в обход гейта)

Если нужно доставить срочно, не дожидаясь зелёного CI:

```
cd delivery/frontend
railway up --ci --yes --service crm
```

`.gitignore` исключает `node_modules`/`.next`, аплоад маленький. Проверять флип
живым логином демо-брокера (`broker.demo@casa.kz` / `demo1234`): после входа URL
и наличие пунктов меню. `railway redeploy` для доставки новых правок НЕ годится —
он пересобирает последний **успешный** деплой (старый код), а не HEAD.
