# CI/CD

Два workflow в `.github/workflows/`:

| Workflow | Когда | Что делает |
|---|---|---|
| `ci.yml` | push в `master`, любой PR, вручную | Гейт качества: typecheck + тесты + build всех трёх приложений |
| `deploy.yml` | после **зелёного** CI на `master`, вручную (`workflow_dispatch`) | Собирает Docker-образы, публикует в GHCR, катит на VPS, smoke-тестит |

Поток целиком:

```
push в master
  └─ CI (ci.yml): backend + frontend + casa40  →  зелёный ✓
        └─ Deploy (deploy.yml):
              1) build 3 образов на раннерах GitHub  →  push в GHCR
              2) SSH на VPS: docker compose pull && up -d
              3) smoke-тест трёх витрин
```

Тяжёлая сборка идёт **на раннерах GitHub**, а не на VPS (на Basic-2 сборка одного
только фронта занимала ~20 минут). VPS больше ничего не собирает — только тянет
готовые образы и перезапускает контейнеры. Это же убирает «buildkit COPY CACHED».

---

## `ci.yml` — гейт качества

Три параллельные джобы (Node 22).

**Backend** (`delivery/backend`), с поднятым `postgres:16-alpine`:
`npm ci` → `prisma generate` → `typecheck` → `npm test` → `build` →
`prisma migrate deploy` → seed → поднять API на `PORT=3002`, дождаться `/health` →
`npm run test:integration` (интеграционные + security-тесты против живого сервера).

**Frontend** (`delivery/frontend`): `npm ci` → typecheck → `npm test` → `next build`.

**casa40** (`casa40-main`): `npm ci --legacy-peer-deps` → `tsc --noEmit` → `npm test` → `vite build`.

CI **не** содержит секретов прода — только одноразовые CI-значения (throwaway
`JWT_SECRET`, тестовая БД). Настоящие секреты живут только в `.env` на VPS.

---

## `deploy.yml` — выкатка на VPS

### Джоба `build` (matrix ×3)
Логинится в GHCR эфемерным `GITHUB_TOKEN` и билдит/пушит:

| App | Context | Build-arg | Образ |
|---|---|---|---|
| backend | `delivery/backend` | — | `ghcr.io/xoxmach7/casa-backend` |
| frontend | `delivery/frontend` | `NEXT_PUBLIC_API_URL=https://pro.casa.kz/api` | `ghcr.io/xoxmach7/casa-frontend` |
| casa40 | `casa40-main` | `VITE_API_URL=` (пусто → same-origin) | `ghcr.io/xoxmach7/casa-casa40` |

Теги: `latest` и `<sha>` коммита. Слои кэшируются в GitHub Actions cache (`type=gha`).

### Джоба `deploy` (после `build`)
Окружение `production` (можно повесить ревьювера — станет ручной гейт).

1. SSH-ключом (`secrets.VPS_SSH_KEY`) заходит на VPS.
2. `scp` актуального `docker-compose.vps.yml` на сервер.
3. На сервере логинится в GHCR эфемерным `GITHUB_TOKEN` (scope `packages:read`),
   `docker compose pull` нужных образов по тегу `<sha>`, `up -d`, `image prune`, `logout`.
   Тег передаётся через `IMAGE_TAG` — деплой детерминированный (ровно этот коммит).
4. Smoke-тест: `pro.casa.kz/login`→200, `casa.kz/`→200, `pro.casa.kz/api/clients`→401.

Образы GHCR держатся **приватными** — VPS тянет их авторизуясь одноразовым
`GITHUB_TOKEN` в момент деплоя, никакого долгоживущего токена на сервере нет.

---

## Требуемые секреты репозитория

| Secret | Значение |
|---|---|
| `VPS_HOST` | IP VPS |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | приватный SSH-ключ деплоя (пара к ключу в `~/.ssh/authorized_keys` на VPS) |

`GITHUB_TOKEN` подставляется автоматически (нужны `packages: write` в `build` и
`packages: read` в `deploy` — заданы в самом workflow).

---

## Ручной прогон и откат

**Задеплоить вручную:** Actions → «Deploy to production (VPS)» → Run workflow.
Либо `gh workflow run deploy.yml`.

**Откат** на предыдущий коммит `<sha>` (образы с этим тегом уже в GHCR):
```bash
ssh ubuntu@<VPS_HOST>
cd ~/casa/delivery/deployment
echo <GHCR_TOKEN> | docker login ghcr.io -u xoxmach7 --password-stdin   # или уже залогинен
export IMAGE_TAG=<sha_предыдущего_коммита>
docker compose -f docker-compose.vps.yml pull backend frontend casa40
docker compose -f docker-compose.vps.yml up -d backend frontend casa40 nginx
```

**Локальная разработка** по-прежнему работает через `build:` в compose
(`docker compose ... up -d --build`) — `image:`/GHCR её не ломает.

---

## Что осталось за кадром (осознанно)

- **Миграции БД** (`prisma migrate deploy`) на проде — пока накатываются вручную;
  в CD-джобу не вшиты, чтобы случайная миграция не поехала на живую базу без
  ревью. Кандидат на отдельный gated-шаг.
- **SSH по паролю** на VPS оставлен включённым (деплой ходит по ключу). Отключение
  парольного входа — отдельное решение пользователя.
