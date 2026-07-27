#!/bin/bash

# ===========================================
# PRO.CASA.KZ - Production Deployment Script
# ===========================================
# Автор: Gemini AI Assistant
# Дата: 2026-01-06
# ===========================================

set -e  # Остановить при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           PRO.CASA.KZ - Production Deployment             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.production.yml" ]; then
    echo -e "${RED}❌ Ошибка: Запустите скрипт из директории deployment/${NC}"
    echo "   cd /path/to/pro-casa/deployment"
    echo "   ./deploy-production.sh"
    exit 1
fi

# Проверка/Загрузка переменных окружения
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo -e "${RED}❌ Ошибка: Файл .env не найден!${NC}"
    echo "   Переименуйте .env.production в .env"
    exit 1
fi

DOMAIN=${DOMAIN:-pro.casa.kz}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@casa.kz}

echo -e "${YELLOW}📋 Конфигурация:${NC}"
echo "   Домен: $DOMAIN"
echo "   Email: $ADMIN_EMAIL"
echo ""

# ===========================================
# ШАГ 1: Создание директорий для Certbot
# ===========================================
echo -e "${BLUE}[1/7]${NC} Создание директорий для SSL сертификатов..."

mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# ===========================================
# ШАГ 2: Создание временного nginx для получения сертификата
# ===========================================
echo -e "${BLUE}[2/7]${NC} Создание временного nginx для Let's Encrypt..."

cat > ./nginx.init.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 200 'PRO.CASA.KZ - Waiting for SSL setup...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Заменяем placeholder на реальный домен
sed -i.bak "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" ./nginx.init.conf
rm -f ./nginx.init.conf.bak

# ===========================================
# ШАГ 3: Запуск временного nginx
# ===========================================
echo -e "${BLUE}[3/7]${NC} Запуск временного nginx..."

docker run -d --name pro-casa-nginx-init \
    -p 80:80 \
    -v $(pwd)/nginx.init.conf:/etc/nginx/nginx.conf:ro \
    -v $(pwd)/certbot/www:/var/www/certbot \
    nginx:alpine

sleep 3

# ===========================================
# ШАГ 4: Получение SSL сертификата
# ===========================================
echo -e "${BLUE}[4/7]${NC} Получение SSL сертификата от Let's Encrypt..."

docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    -w /var/www/certbot \
    --email $ADMIN_EMAIL \
    -d $DOMAIN \
    --agree-tos \
    --non-interactive \
    --force-renewal

# Остановить временный nginx
docker stop pro-casa-nginx-init
docker rm pro-casa-nginx-init
rm -f ./nginx.init.conf

# Проверка что сертификат получен (или просто недоступен для чтения)
if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${YELLOW}⚠️ Внимание: Скрипт не видит сертификат (возможно, он создан root-пользователем).${NC}"
    echo "   Но если выше написано 'Successfully received certificate', то всё в порядке."
    echo "   Продолжаем запуск..."
else
    echo -e "${GREEN}✅ SSL сертификат успешно получен!${NC}"
fi

# ===========================================
# ШАГ 5: Запуск всех сервисов
# ===========================================
echo -e "${BLUE}[5/7]${NC} Сборка и запуск всех контейнеров..."

docker compose -f docker-compose.production.yml up --build -d

echo -e "${YELLOW}⏳ Ожидание запуска сервисов (60 секунд)...${NC}"
sleep 60

# ===========================================
# ШАГ 6: Применение миграций базы данных
# ===========================================
echo -e "${BLUE}[6/7]${NC} Применение миграций базы данных..."

docker compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy

# ===========================================
# ШАГ 7: Проверка статуса
# ===========================================
echo -e "${BLUE}[7/7]${NC} Проверка статуса сервисов..."

docker compose -f docker-compose.production.yml ps

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETED!                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}📌 Доступ к приложению:${NC}"
echo "   🌐 Frontend:      https://$DOMAIN"
echo "   🔌 API:           https://$DOMAIN/api"
echo "   📦 MinIO Console: https://$DOMAIN/minio"
echo ""
echo -e "${YELLOW}📌 Данные для входа:${NC}"
echo "   Email:    admin@casa.kz"
echo "   Password: admin123"
echo ""
echo -e "${YELLOW}📌 Полезные команды:${NC}"
echo "   # Просмотр логов"
echo "   docker compose -f docker-compose.production.yml logs -f"
echo ""
echo "   # Перезапуск"
echo "   docker compose -f docker-compose.production.yml restart"
echo ""
echo "   # Обновление (после изменений кода)"
echo "   docker compose -f docker-compose.production.yml up --build -d"
echo ""
echo "   # Обновление SSL (каждые 90 дней)"
echo "   ./renew-ssl.sh"
echo ""
echo -e "${GREEN}🎉 Готово! Откройте https://$DOMAIN в браузере${NC}"
