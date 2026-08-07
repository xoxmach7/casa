# Оптимизированный для продакшена
FROM node:20-alpine AS base

# Deps stage
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Force devDependencies to install regardless of any ambient NODE_ENV the
# build platform might inject — plain `npm ci` under NODE_ENV=production
# silently omits devDependencies (typescript, tailwindcss, its postcss
# plugin, tw-animate-css are all devDeps, all needed to build).
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
ENV NPM_CONFIG_OMIT=

COPY package.json package-lock.json* ./
RUN npm ci --include=dev
RUN test -d node_modules/tw-animate-css && echo "OK: tw-animate-css present" || (echo "FAIL: tw-animate-css missing after npm ci" && exit 1)

# Builder stage  
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arg for API URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache curl

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
