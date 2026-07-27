# 🚀 Полное Руководство по Деплою (pro.casa.kz)

Следуйте этим шагам строго по порядку на вашем сервере.

## Шаг 1: Подготовка файлов

1. **Зайдите на сервер** и перейдите в папку проекта:
   ```bash
   cd ~/pro-casa
   git pull origin main
   cd deployment
   ```

2. **Создайте файл конфигурации `.env`**:
   Скопируйте команду ниже целиком и вставьте в терминал (это создаст файл с нужными настройками):

   ```bash
   cat <<EOF > .env
   # --- Database ---
   POSTGRES_USER=pro_casa_admin
   POSTGRES_PASSWORD=SecureValut_2025_Pass!
   POSTGRES_DB=pro_casa_db
   
   # --- Backend Security ---
   JWT_SECRET=$(openssl rand -hex 32)
   CORS_ORIGIN=https://pro.casa.kz
   NODE_ENV=production
   PORT=3001
   
   # --- MinIO (Файловое хранилище) ---
   MINIO_ROOT_USER=minio_admin
   MINIO_ROOT_PASSWORD=Minio_STORAGE_2025!
   MINIO_ENDPOINT=minio
   MINIO_BUCKET=pro-casa-files
   
   # --- Frontend ---
   NEXT_PUBLIC_API_URL=https://pro.casa.kz/api
   EOF
   ```

## Шаг 2: Проверка DNS

**ВАЖНО:** Перед продолжением убедитесь, что вы создали **A-запись** у регистратора домена.
- **Host:** `@` (или `pro.casa.kz`)
- **IP:** Ваш IP адрес сервера (тот же, куда вы подключены по SSH).

*Если вы только что создали запись, подождите 5-10 минут.*

## Шаг 3: Чистый запуск (HTTP)

1. Очистите старые контейнеры во избежание конфликтов:
   ```bash
   docker rm -f pro-casa-frontend pro-casa-backend pro-casa-db pro-casa-minio pro-casa-nginx pro-casa-certbot pro-casa-minio-init || true
   ```

2. Запустите проект:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Проверьте, что сайт открывается по адресу **http://pro.casa.kz** (может быть "Небезопасно", это нормально).

## Шаг 4: Получение SSL сертификата

1. Запустите Certbot:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm certbot
   ```
   *Следуйте инструкциям: введите Email -> Agree (A) -> No Share (N).*

   **Если ошибка `NXDOMAIN`:** Значит DNS еще не обновился. Подождите 15 минут и попробуйте снова.

## Шаг 5: Включение HTTPS

Только после успешного получения сертификата!

1. Откройте конфиг Nginx:
   ```bash
   nano nginx.conf
   ```

2. **Раскомментируйте 2 строки** (уберите знак `#` в начале) в блоке `server { listen 443 ssl ... }`:
   
   *Было:*
   ```nginx
   # ssl_certificate /etc/letsencrypt/live/pro.casa.kz/fullchain.pem;
   # ssl_certificate_key /etc/letsencrypt/live/pro.casa.kz/privkey.pem;
   ```
   
   *Стало:*
   ```nginx
   ssl_certificate /etc/letsencrypt/live/pro.casa.kz/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/pro.casa.kz/privkey.pem;
   ```

3. Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`.

4. Примените настройки:
   ```bash
   docker compose -f docker-compose.prod.yml restart nginx
   ```

**Готово!** Ваш сайт доступен по https://pro.casa.kz 🚀
