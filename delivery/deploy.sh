#!/bin/bash
set -e

echo "🚀 PRO.casa.kz Production Deployment"
echo "======================================"

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен!"
    exit 1
fi

# Создаем папку для SSL если нет
mkdir -p deployment/ssl

# Останавливаем ВСЕ старые контейнеры pro-casa
echo "📦 Останавливаем старые контейнеры..."
docker stop pro-casa-frontend pro-casa-backend pro-casa-db pro-casa-minio pro-casa-minio-init pro-casa-nginx 2>/dev/null || true
docker rm pro-casa-frontend pro-casa-backend pro-casa-db pro-casa-minio pro-casa-minio-init pro-casa-nginx 2>/dev/null || true

# Удаляем старые образы (освобождаем место)
echo "🗑️  Удаляем старые образы..."
docker image prune -f

# Собираем новые образы
echo "🔨 Собираем Docker образы (это может занять 5-10 минут)..."
docker compose build --no-cache

# Запускаем все сервисы
echo "▶️  Запускаем все сервисы..."
docker compose up -d

# Ждем пока БД будет готова
echo "⏳ Ожидаем готовности PostgreSQL..."
sleep 10

# Применяем миграции
echo "📋 Применяем миграции базы данных..."
docker compose exec -T backend npx prisma db push --accept-data-loss

# Загружаем seed данные
echo "🌱 Загружаем базовые данные..."
docker compose exec -T backend npm run db:seed:production || echo "Seed уже загружен или не требуется"

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📊 Статус сервисов:"
docker compose ps
echo ""
echo "🌐 Приложение доступно по адресам:"
echo "  - Frontend: http://pro.casa.kz (или IP:80)"
echo "  - Backend API: http://pro.casa.kz/api"
echo "  - MinIO Console: http://IP:9001"
echo ""
echo "👤 Тестовые аккаунты:"
echo "  - Админ:       admin@casa.kz / admin123"
echo "  - Брокер:      broker@casa.kz / broker123"
echo "  - Застройщик:  developer@casa.kz / developer123"
echo ""
echo "📝 Полезные команды:"
echo "  - Логи:            docker compose logs -f"
echo "  - Логи frontend:   docker logs -f pro-casa-frontend"
echo "  - Логи backend:    docker logs -f pro-casa-backend"
echo "  - Остановка:       docker compose down"
echo "  - Перезапуск:      docker compose restart"
echo ""
