#!/bin/bash

echo "🚀 Запуск PRO.casa.kz в dev режиме..."
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Останавливаем все
echo "🛑 Останавливаем все сервисы..."
docker compose down 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Запускаем PostgreSQL
echo ""
echo "🐘 Запускаем PostgreSQL..."
docker compose up -d postgres

# Ждем готовности
echo "⏳ Ожидаем готовности БД (5 сек)..."
sleep 5

# Проверяем что БД запущена
if ! docker ps | grep -q pro-casa-db; then
    echo -e "${RED}❌ PostgreSQL не запустился!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL запущен${NC}"

# Создаем таблицы
echo ""
echo "📋 Создаем таблицы БД..."
cd backend
docker exec -i pro-casa-db psql -U pro_casa_user -d pro_casa_db < migrations.sql 2>&1 | grep -E "(CREATE|ERROR)" | head -5

# Загружаем seed данные
echo "🌱 Загружаем тестовые данные..."
docker exec -i pro-casa-db psql -U pro_casa_user -d pro_casa_db < seed.sql 2>&1 | grep -E "(INSERT|email|ERROR)" | head -5

cd ..

echo ""
echo -e "${GREEN}✅ База данных готова!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}📝 Теперь запустите в отдельных терминалах:${NC}"
echo ""
echo -e "${GREEN}Terminal 1 - Backend:${NC}"
echo "  cd backend"
echo "  rm -rf node_modules/.prisma node_modules/@prisma/client"
echo "  DATABASE_URL=\"postgresql://pro_casa_user:pro_casa_dev_password@localhost:5432/pro_casa_db?schema=public\" npx prisma generate"
echo "  DATABASE_URL=\"postgresql://pro_casa_user:pro_casa_dev_password@localhost:5432/pro_casa_db?schema=public\" npm run dev"
echo ""
echo -e "${GREEN}Terminal 2 - Frontend:${NC}"
echo "  cd pro-casa"
echo "  npm run dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 После запуска откройте: http://localhost:3000"
echo "👤 Логин: admin@casa.kz / admin123"
echo ""
