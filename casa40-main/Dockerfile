# casa40-main is a Vite SPA — unlike the Next.js public site or the CRM
# frontend, `vite build` produces static files with no Node server needed at
# runtime. Serve them with nginx, matching how the two other services here
# already run in Docker on Railway (see delivery/backend/Dockerfile.prod,
# delivery/frontend/Dockerfile).

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Vite inlines VITE_* vars at build time — must be passed as a build ARG,
# setting it at container runtime would have no effect.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
