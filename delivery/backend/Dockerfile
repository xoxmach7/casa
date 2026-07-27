FROM node:20-slim

WORKDIR /app

# Устанавливаем OpenSSL для Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем все файлы проекта
COPY . .

# Открываем порт
EXPOSE 3001

# Запускаем через tsx (не компилируем, используем runtime env vars)
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --accept-data-loss && npx tsx src/index.ts"]
