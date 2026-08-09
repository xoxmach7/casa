# CI/CD

Два workflow в `.github/workflows/`:

| Workflow | Когда | Что делает |
|---|---|---|
| `ci.yml` | push в master, любой PR, вручную | Проверяет все три приложения |
| `deploy.yml` | после успешного CI на master, вручную | Ждёт выкатки и проверяет прод |

## `ci.yml` — гейт качества

Три параллельные джобы.

**Backend** (`delivery/backend`), с поднятым `postgres:16-alpine`:

1. `npm ci`
2. `prisma generate`
3. `npm run typecheck` — `tsc --noEmit`
4. `npm test` — юнит/роут-тесты (Prisma замокан, сеть не нужна)
5. `npm run build`
6. `prisma migrate deploy` — заодно ловит миграцию, которая не накатывается на чистую базу
7. `tsx src/prisma/seed.ts`
8. Поднимает API на `PORT=3002`, ждёт `/health`
9. `npm run test:integration` — 123 интеграционных и security-теста против живого сервера

Пункты 6–9 — то, чего раньше не было: `api.test.ts` и `security.test.ts` требуют работающего сервера, поэтому локально они всегда падали с `ECONNREFUSED` и фактически не выполнялись ни разу. Теперь это отдельный конфиг (`vitest.integration.config.ts`) и отдельный шаг CI.

**Frontend** (`delivery/frontend`): `npm ci` → typecheck → `npm test` (vitest + Testing Library) → `next build`.

**casa40** (`casa40-main`): `npm ci` → typecheck → `npm test` → `vite build`.

### Почему юнит и интеграция разведены

`npm test` должен работать везде и всегда — на ноутбуке, в CI, в pre-commit. Тесты, которым нужен живой сервер, в этот набор не входят: их отсутствие означало бы «здесь не запускались», а не «сломаны». Списки не разъезжаются, потому что оба конфига читают один и тот же массив из `vitest.files.ts`.

`NODE_ENV=test` в CI ослабляет rate-limiter (иначе 123 теста с логинами упираются в лимит 20 попыток/15 мин и падают не по делу). Остальное поведение — как в проде: `error.middleware` не отдаёт стектрейсы, потому что это не `development`.

## `deploy.yml` — проверка выкатки

Railway собирает master сам, через GitHub-интеграцию. Workflow делает вторую половину: дожидается, пока прод действительно начнёт отдавать нужный коммит, и проверяет живые эндпоинты.

`GET /health` бэкенда отдаёт поле `commit` из `RAILWAY_GIT_COMMIT_SHA`. Workflow опрашивает его до совпадения с проверенным коммитом (до 15 минут) — то есть «выкатилось» это наблюдаемый факт, а не догадка о таймингах.

Дальше смоук:

- `/health` → `status: ok` и `db: connected`
- `GET /api/clients` без токена → должен быть `401` (ловит деплой с отключённой авторизацией)
- `/login` в CRM → `200`
- `/` публичного сайта → `200`

## Миграции применяются РУКАМИ

Ни в `Dockerfile.prod`, ни в команде старта нет `prisma migrate deploy`. Railway выкатывает новый код, но схему базы не трогает — все 36 миграций накатывались вручную.

Это ловушка, и она уже сработала 2026-08-09: миграция `20260809120000_add_coordinator_analyst_roles` не доехала до прода, админка предлагала роль «Координатор сделок», а база отвечала `invalid input value for enum "UserRole"`. Заметить это можно было только попыткой создать такого пользователя.

**Пока не автоматизировано — после каждого пуша с новой миграцией:**

```bash
cd delivery/backend
PUB=$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)
DATABASE_URL="$PUB" npx prisma migrate status   # что не применено
DATABASE_URL="$PUB" npx prisma migrate deploy   # применить
```

Внутренний `DATABASE_URL` сервиса `backend` для этого не годится — это `postgres.railway.internal`, снаружи он не резолвится. Нужен именно `DATABASE_PUBLIC_URL` сервиса `Postgres` (TCP-прокси Railway).

## Что нужно настроить руками (один раз)

**1. Жёсткий гейт в Railway.** Для каждого сервиса (`backend`, `crm`, `casa40`): Settings → Deploy → включить **Wait for CI**. Без этого Railway начнёт сборку сразу по пушу, не дожидаясь проверок, и CI останется просто сигнализацией. Включено 2026-08-09.

**1a. Отключить Vercel от этого репозитория — до того, как включать гейт.** К репозиторию, кроме Railway, был подключён проект Vercel, падавший на каждом пуше: 59 неуспешных деплойментов подряд (`gh api repos/xoxmach7/casa/deployments` показывает обоих ботов). Прод он не обслуживал.

Дело не в косметике. Сводный статус коммита из-за него был `failure`:

```
gh api repos/xoxmach7/casa/commits/<sha>/status
combined=failure
  Vercel: failure
  pro-casa-backend - backend: success
  ...
```

Пока Wait for CI не работал, это была просто грязь. С работающим гейтом Railway ждал бы зелёного статуса, которого Vercel никогда не даст, и прод перестал бы выкатываться вообще — а выглядело бы это как «Railway сломался». Отключено 2026-08-09.

**2. Адреса прода** — Settings → Secrets and variables → Actions → вкладка **Variables**:

| Переменная | Пример |
|---|---|
| `PROD_API_URL` | `https://<backend>.up.railway.app` |
| `PROD_CRM_URL` | `https://<crm>.up.railway.app` |
| `PROD_SITE_URL` | `https://<casa40>.up.railway.app` |

Это именно variables, не secrets — адреса публичные, и в логах их видно намеренно. Если `PROD_API_URL` не задана, `deploy.yml` мирно ничего не делает и говорит об этом в логе.

## Запуск локально

```bash
# юниты — ничего поднимать не нужно
cd delivery/backend && npm test
cd delivery/frontend && npm test

# интеграция + security: нужна база и сервер
docker run -d --name casa-test-db -e POSTGRES_USER=casa -e POSTGRES_PASSWORD=casa \
  -e POSTGRES_DB=casa_test -p 5439:5432 postgres:16-alpine

cd delivery/backend
export DATABASE_URL="postgresql://casa:casa@localhost:5439/casa_test?schema=public"
export JWT_SECRET=local-test PORT=3002 NODE_ENV=test
npx prisma migrate deploy && npx tsx src/prisma/seed.ts
npx tsx src/index.ts &
npm run test:integration
```
