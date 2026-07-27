#!/bin/bash

# ===========================================
# PRO.CASA.KZ - Pack for Server
# ===========================================
# Этот скрипт подготавливает архив для отправки на сервер
# ===========================================

# Проверка что мы в pro-casa/deployment или в pro-casa
if [ -f "docker-compose.production.yml" ]; then
    cd ..
elif [ ! -f "deployment/docker-compose.production.yml" ]; then
    echo "❌ Запустите скрипт из корня проекта или из папки deployment"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="pro-casa_deploy_${TIMESTAMP}.tar.gz"

echo "📦 Упаковка проекта для отправки на сервер..."
echo "   Архив: ${ARCHIVE_NAME}"

# Исключаем лишнее: node_modules, .git, локальные .env, и т.д.
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    --exclude='postgres_data' \
    --exclude='minio_data' \
    --exclude='deployment/certbot/conf/live' \
    --exclude='deployment/certbot/conf/archive' \
    -czf deployment/${ARCHIVE_NAME} \
    .

echo ""
echo "✅ Архив создан: deployment/${ARCHIVE_NAME}"
echo ""
echo "🚀 Инструкция по отправке:"
echo ""
echo "   1. Скопируйте архив на сервер:"
echo "      scp deployment/${ARCHIVE_NAME} user@your-server-ip:/opt/"
echo ""
echo "   2. Зайдите на сервер:"
echo "      ssh user@your-server-ip"
echo ""
echo "   3. Распакуйте:"
echo "      cd /opt"
echo "      mkdir pro-casa && tar -xzf ${ARCHIVE_NAME} -C pro-casa"
echo "      cd pro-casa/deployment"
echo ""
echo "   4. Запустите:"
echo "      ./deploy-production.sh"
echo ""
