# PRO-CASA — CRM для риелторов Казахстана

**Продакшен:** https://pro-casa.qaspilab.com  
**Стек:** Next.js 16 · Express · PostgreSQL · Prisma · MinIO · Docker

---

## Структура поставки

```
delivery/
├── backend/          — серверная часть (Express + Prisma)
├── frontend/         — клиентская часть (Next.js)
├── deployment/       — конфиги Docker Compose, Nginx, скрипты деплоя
├── docker-compose.yml — локальный запуск (dev)
├── .env.example      — шаблон переменных окружения
├── deploy.sh         — скрипт быстрого запуска
├── start-dev.sh      — запуск в режиме разработки
└── docs/
    ├── PROJECT_SETUP.md              — полная инструкция по настройке и деплою
    ├── BUSINESS_LOGIC.md             — бизнес-логика системы
    ├── TECHNICAL_ARCHITECTURE.md     — техническая архитектура (детально)
    └── АКТ_ПРИЕМА_ПЕРЕДАЧИ_ФИНАЛЬНЫЙ — акт приёма-передачи
```

---

## Быстрый старт

```bash
# 1. Скопировать и заполнить переменные окружения
cp .env.example .env

# 2. Запустить все сервисы
./deploy.sh
# или вручную:
docker compose up -d --build

# 3. Применить миграции БД
docker compose exec backend npx prisma migrate deploy

# 4. Заполнить тестовыми данными
docker compose exec backend npx tsx src/prisma/seed.ts
```

После запуска:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Логин: `admin@casa.kz` / `Test1234`

---

## Документация

| Документ | Описание |
|---|---|
| `docs/PROJECT_SETUP.md` | Деплой на сервер, Docker, Git, команды |
| `docs/BUSINESS_LOGIC.md` | Воронки, стратегии, бизнес-процессы |
| `docs/TECHNICAL_ARCHITECTURE.md` | Полная техническая архитектура |
