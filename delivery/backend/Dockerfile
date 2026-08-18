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
# Без --accept-data-loss: при расхождении схемы push ОТКАЖЕТСЯ (безопасно),
# а не применит молча с потерей данных. В синхроне — no-op, как и раньше.
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npx tsx src/index.ts"]
