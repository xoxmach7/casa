#!/bin/bash

# ===========================================
# PRO.CASA.KZ - SSL Certificate Renewal
# ===========================================
# Запускайте этот скрипт каждые 60-90 дней
# или добавьте в cron
# ===========================================

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔐 Обновление SSL сертификата...${NC}"

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.production.yml" ]; then
    echo "❌ Запустите скрипт из директории deployment/"
    exit 1
fi

# Загрузка переменных
export $(grep -v '^#' .env.production | xargs)

# Обновление сертификата
docker compose -f docker-compose.production.yml run --rm certbot renew

# Перезагрузка nginx для применения нового сертификата
docker compose -f docker-compose.production.yml exec nginx nginx -s reload

echo -e "${GREEN}✅ SSL сертификат обновлён!${NC}"

# ===========================================
# CRON JOB (добавьте в crontab -e):
# ===========================================
# # Обновление SSL каждый понедельник в 3:00
# 0 3 * * 1 cd /path/to/deployment && ./renew-ssl.sh >> /var/log/ssl-renew.log 2>&1
# ===========================================
