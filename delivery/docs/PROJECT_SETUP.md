# PRO-CASA — Полная документация по настройке проекта

## 📋 Общее описание

**PRO-CASA** — CRM-система для риэлторов (Казахстан). Стек:
- **Frontend:** Next.js 16.0.7 (React 19, Turbopack, standalone output)
- **Backend:** Express.js + TypeScript (tsx), Prisma ORM 6.19.0
- **БД:** PostgreSQL 16 (Alpine)
- **Хранилище файлов:** MinIO (S3-compatible)
- **Деплой:** Docker Compose
- **Домен:** https://pro-casa.kz

---

## 🖥 СЕРВЕР (продакшен)

### Доступ
- **IP:** 91.224.74.111
- **SSH:** `ssh root@91.224.74.17`
- **Пароль SSH:** `aHtth5hdnCQ
- **ОС:** Ubuntu, 7.8GB RAM, 4 CPU
- **Docker:** 29.3.1

### Структура на сервере
```
/root/pro-casa/
├── deployment/
│   ├── docker-compose.server.yml   ← основной файл для сервера
│   └── .env.production             ← переменные окружения
├── backend/
│   ├── Dockerfile.prod             ← Dockerfile бэкенда (tsx, не tsc build)
│   ├── prisma/schema.prisma        ← схема БД (1305 строк, 40+ моделей)
│   └── src/
├── pro-casa/
│   ├── Dockerfile                  ← multi-stage build (standalone)
│   └── ...
└── ...
```

### Docker Compose (сервер) — `deployment/docker-compose.server.yml`

4 сервиса (без nginx/certbot — на сервере используется системный nginx):

| Сервис | Образ | Порт внешний → внутренний | Описание |
|--------|-------|--------------------------|----------|
| **postgres** | postgres:16-alpine | нет (внутренний 5432) | БД |
| **minio** | minio/minio:latest | нет (внутренний 9000/9001) | Файловое хранилище |
| **backend** | build: ../backend (Dockerfile.prod) | **3061 → 3001** | Express API |
| **frontend** | build: ../pro-casa | **3060 → 3000** | Next.js |

Также есть одноразовый сервис `minio-init` (создаёт бакет `pro-casa-files`).

### Переменные окружения на сервере (`.env.production`)
```env
DOMAIN=pro-casa.qaspilab.com
POSTGRES_USER=pro_casa_user
POSTGRES_PASSWORD=aHtth5hdnCQ213eawseqw
POSTGRES_DB=pro_casa_db
DATABASE_URL=postgresql://pro_casa_user:aHtth5hdnCQ213eawseqw@postgres:5432/pro_casa_db?schema=public
JWT_SECRET=proCasa2026_xK9mP2vL8qW4nR7jT1bY5hA3dF6gZ0
NODE_ENV=production
PORT=3001
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=MinIO_proCasa_2026_sEcUrE
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio_admin
MINIO_SECRET_KEY=MinIO_proCasa_2026_sEcUrE
MINIO_BUCKET=pro-casa-files
MINIO_USE_SSL=false
NEXT_PUBLIC_API_URL=https://pro-casa.qaspilab.com/api
CORS_ORIGIN=https://pro-casa.qaspilab.com
BACKEND_URL=http://backend:3001
```

### Системный Nginx (на сервере, НЕ в Docker)

Nginx установлен через apt на сервере. Конфиг `/etc/nginx/sites-enabled/pro-casa`:
```nginx
server {
    server_name pro-casa.qaspilab.com;
    
    location / {
        proxy_pass http://127.0.0.1:3060;  # frontend контейнер
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3061/api/;  # backend контейнер
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3061/uploads/;
    }

    # SSL managed by Certbot (expires 2026-06-28)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/pro-casa.qaspilab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pro-casa.qaspilab.com/privkey.pem;
}

server {
    listen 80;
    server_name pro-casa.qaspilab.com;
    return 301 https://$host$request_uri;
}
```

### SSL
- Certbot + Let's Encrypt
- Сертификат автоматически обновляется (systemd timer)
- Истекает: **2026-06-28**

### PM2 (другие сайты на том же сервере)
На сервере также работают через PM2: garantipoteki, qaspilab, raycon, scorify, target.raycon, tobacco-shop.

---

## 🗄 База данных

### Prisma Schema
- **Файл:** `backend/prisma/schema.prisma` (1305 строк)
- **Provider:** PostgreSQL
- **Binary targets:** `["native", "debian-openssl-3.0.x"]`
- **12 миграций** применены на сервере

### Ключевые модели
`User`, `Client`, `Property`, `CrmProperty`, `Seller`, `Buyer`, `Deal`, `Booking`, `Project`, `CourseProgress`, `Notification`, `Task`, `Payment`, `LeadForm`, `CustomFunnel`, `CustomField`, `Event`, `Subscription`, `MortgageApplication` и другие.

### Перечисления (Enums)
- `UserRole`: ADMIN, DEVELOPER, BROKER, AGENCY, REALTOR
- `CertificationStatus`: IN_PROGRESS, CERTIFIED, EXPIRED

### Seed пользователи (на сервере)
| Email | Роль | Пароль |
|-------|------|--------|
| admin@casa.kz | ADMIN | Test1234 |
| dev@casa.kz | DEVELOPER | Test1234 |
| realtor@casa.kz | REALTOR | Test1234 |
| agency@casa.kz | AGENCY | Test1234 |
| broker@casa.kz | BROKER | Test1234 |

---

## 🚀 Команды серверного деплоя

### Обновление кода и пересборка
```bash
# SSH на сервер
ssh root@91.224.74.17

# Перейти в проект
cd /root/pro-casa

# Подтянуть изменения
git pull

# Пересобрать все контейнеры
cd deployment
docker compose -f docker-compose.server.yml --env-file .env.production up -d --build

# Пересобрать только backend
docker compose -f docker-compose.server.yml --env-file .env.production up -d --build backend

# Пересобрать только frontend
docker compose -f docker-compose.server.yml --env-file .env.production up -d --build frontend

# Пересобрать БЕЗ кэша (при проблемах с кэшем)
docker compose -f docker-compose.server.yml --env-file .env.production build --no-cache frontend
docker compose -f docker-compose.server.yml --env-file .env.production up -d frontend
```

### Миграции БД на сервере
```bash
cd /root/pro-casa/deployment
docker compose -f docker-compose.server.yml --env-file .env.production exec backend npx prisma migrate deploy
```

### Seed данных на сервере
```bash
docker compose -f docker-compose.server.yml --env-file .env.production exec backend npx tsx src/prisma/seed.ts
```

### Логи
```bash
cd /root/pro-casa/deployment

# Все логи
docker compose -f docker-compose.server.yml logs -f

# Только backend
docker compose -f docker-compose.server.yml logs -f backend

# Только frontend
docker compose -f docker-compose.server.yml logs -f frontend
```

### SQL запросы напрямую
```bash
docker compose -f docker-compose.server.yml exec postgres psql -U pro_casa_user -d pro_casa_db
```

### Статус контейнеров
```bash
docker compose -f docker-compose.server.yml ps
```

---

## 💻 ЛОКАЛЬНАЯ РАЗРАБОТКА

### Требования
- Node.js 20+
- Docker & Docker Compose
- Git

### Git конфигурация
```
# Два remote:
origin  = github.com/AGGIB/pro-casa         (приватный)
public  = github.com/Ali-Fayzullaev/pro-casa (публичный, сервер тянет отсюда)

# Локальная ветка: part1
# Пуш на сервер (public remote):
git push public part1:main
```

### Вариант 1: Docker Compose (рекомендуемый)

Используется `docker-compose.yml` в корне (6 сервисов):

| Сервис | Порт | Описание |
|--------|------|----------|
| postgres | **5434** → 5432 | БД (порт 5434, чтобы не конфликтовать с локальным PostgreSQL) |
| minio | **9000**, **9001** | Файловое хранилище + консоль |
| backend | **3001** | Express API |
| frontend | **3000** | Next.js |
| nginx | **80**, **443** | Reverse proxy (опционально) |
| certbot | — | SSL сертификаты (опционально) |

```bash
# Запуск (из корня проекта)
docker compose up -d

# Или только нужные сервисы (без nginx/certbot)
docker compose up -d postgres minio backend frontend
```

Локальные учётные данные (захардкожены в docker-compose.yml):
- **PostgreSQL:** `pro_casa_user` / `pro_casa_dev_password`, БД = `pro_casa_db`
- **MinIO:** `minio_admin` / `minio_secret_password`

### Вариант 2: Без Docker (npm dev)

#### 1. PostgreSQL
Нужен локальный PostgreSQL или Docker-контейнер:
```bash
# Отдельный контейнер PostgreSQL
docker run -d --name pro-casa-db \
  -e POSTGRES_USER=pro_casa_user \
  -e POSTGRES_PASSWORD=pro_casa_dev_password \
  -e POSTGRES_DB=pro_casa_db \
  -p 5434:5432 \
  postgres:16-alpine
```

#### 2. Backend
```bash
cd backend

# Создать .env файл:
# DATABASE_URL=postgresql://pro_casa_user:pro_casa_dev_password@localhost:5434/pro_casa_db?schema=public
# JWT_SECRET=any-dev-secret
# PORT=3001
# NODE_ENV=development

npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed                # посеять тестовых пользователей
npm run dev                    # запуск с hot-reload (tsx watch)
```

Backend будет на http://localhost:3001

#### 3. Frontend
```bash
cd pro-casa

# Создать .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
# BACKEND_URL=http://localhost:3001

npm install
npm run dev                    # Next.js dev с Turbopack
```

Frontend будет на http://localhost:3000

**Важно:** Next.js настроен с `rewrites` — все запросы `/api/*` проксируются на `BACKEND_URL` (по умолчанию `http://localhost:3001`). Поэтому из браузера API доступен по `http://localhost:3000/api/...`.

---

## 🔧 Dockerfiles

### Backend (`backend/Dockerfile.prod`)
- Базовый образ: `node:20-slim`
- Устанавливает OpenSSL (для Prisma) + wget/curl
- `npm ci` → `npx prisma generate` → `npx tsx src/index.ts`
- **Не делает `tsc build`** — запускает TypeScript напрямую через tsx (из-за TS ошибок)
- Порт: 3001

### Frontend (`pro-casa/Dockerfile`)
- Multi-stage build (deps → builder → runner)
- Базовый образ: `node:20-alpine`
- `npm ci` → `npm run build` (Next.js standalone)
- Runner запускает `node server.js`
- Порт: 3000
- Build arg: `NEXT_PUBLIC_API_URL` (передаётся при сборке)

---

## 🔀 Маршрутизация запросов

### На сервере
```
Браузер → https://pro-casa.qaspilab.com
   → Системный Nginx (SSL termination)
      → / → http://127.0.0.1:3060 (frontend контейнер)
      → /api/ → http://127.0.0.1:3061 (backend контейнер)
      → /uploads/ → http://127.0.0.1:3061/uploads/
```

### Локально
```
Браузер → http://localhost:3000
   → Next.js rewrites
      → /api/* → http://localhost:3001/api/*  (backend)
      → /uploads/* → http://localhost:3001/uploads/*
```

---

## 📁 Ключевые файлы

| Файл | Описание |
|------|----------|
| `docker-compose.yml` | Локальный Docker Compose (6 сервисов) |
| `deployment/docker-compose.server.yml` | Серверный Docker Compose (4 сервиса) |
| `deployment/.env.production` | Env-файл на сервере (не в git) |
| `backend/Dockerfile.prod` | Dockerfile бэкенда |
| `pro-casa/Dockerfile` | Dockerfile фронтенда |
| `backend/prisma/schema.prisma` | Схема БД Prisma |
| `backend/src/index.ts` | Точка входа Express |
| `pro-casa/app/layout.tsx` | Корневой layout Next.js |
| `pro-casa/next.config.ts` | Конфиг Next.js (rewrites, standalone) |
| `pro-casa/lib/api-client.ts` | HTTP клиент для API |
| `deployment/nginx.prod.conf` | Nginx конфиг (для Docker-варианта, НЕ используется на текущем сервере) |

---

## ⚠️ Важные заметки

1. **Backend НЕ компилируется через tsc** на продакшене — запускается через `npx tsx src/index.ts` (из-за TS ошибок в процессе сборки)
2. **MinIO переменные закомментированы** в локальном docker-compose.yml для backend — в локальном режиме backend использует локальное хранилище (`uploads/` папка)
3. **Git workflow:** Локальная ветка `part1` → `git push public part1:main` → сервер делает `git pull` из `Ali-Fayzullaev/pro-casa` (main branch)
4. **Frontend standalone:** Next.js собирается в standalone mode, потому `NEXT_PUBLIC_API_URL` нужно передавать как build arg при Docker‑сборке
5. **PowerShell + SSH:** При выполнении команд SSH из Windows PowerShell спецсимволы (`$`, `!`, `@`) нужно экранировать. Лучше загружать SQL-файлы через `scp` и затем `docker exec -i < file.sql`
6. **Ручные ALTER TABLE на сервере:** Были добавлены колонки `recommended_strategy` (TEXT) и `is_strategy_manual` (BOOLEAN DEFAULT false) в таблицу `crm_properties` вручную (не через миграцию)
