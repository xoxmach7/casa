# Деплой crm (frontend) на Railway

Сервис `crm` в проекте `pro-casa-backend` собирается из этого каталога
(`delivery/frontend`, Root Directory) по `Dockerfile`, авто-деплой на push в
`master` с гейтом «Wait for CI».

## Авто-деплой и watchPatterns

Change-detection Railway по одному только Root Directory для этого сервиса
срабатывал **нестабильно**: пуши, где файлы под `delivery/frontend` были только
изменены (а не добавлены), приходили как `SKIPPED`, и прод оставался на старой
сборке при зелёном CI (замечено на коммитах d24beda / f27b4cd / 2d9ff3f,
2026-08-12).

Лечение — явные `watchPatterns` в [`railway.json`](./railway.json):

```json
"watchPatterns": ["delivery/frontend/**"]
```

Паттерн задаётся относительно корня репозитория. Любое изменение под
`delivery/frontend` теперь триггерит пересборку crm.

## Если прод не обновился при зелёном CI

1. Проверить статус: `railway deployment list -s crm` — если верхний `SKIPPED`,
   авто-деплой не собрал коммит.
2. Форс-деплой рабочей копии (минуя git-детект):
   ```
   cd delivery/frontend
   railway up --ci --yes --service crm
   ```
   `.gitignore` исключает `node_modules`/`.next`, аплоад маленький.
3. Проверять флип живым логином демо-брокера
   (`broker.demo@casa.kz` / `demo1234`): после входа URL и наличие пунктов меню.

`railway redeploy` НЕ подходит для доставки новых правок — он пересобирает
последний **успешный** деплой (старый код), а не текущий HEAD.
