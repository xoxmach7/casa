-- Инициализация БД для PRO.casa.kz
-- Этот скрипт выполняется автоматически при первом запуске контейнера

-- Создаем пользователя если не существует
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pro_casa_user') THEN
    CREATE ROLE pro_casa_user WITH LOGIN PASSWORD 'pro_casa_dev_password' SUPERUSER;
  END IF;
END
$$;

-- Даем все права пользователю на БД
GRANT ALL PRIVILEGES ON DATABASE pro_casa_db TO pro_casa_user;

-- Подключаемся к БД
\c pro_casa_db

-- Даем права на схему public
GRANT ALL ON SCHEMA public TO pro_casa_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pro_casa_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pro_casa_user;

-- Устанавливаем права по умолчанию для будущих объектов
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pro_casa_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pro_casa_user;

-- Информация
SELECT 'Database initialized successfully for user pro_casa_user' as status;
