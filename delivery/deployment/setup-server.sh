#!/bin/bash
# ============================================
# PRO-CASA Server Setup & Deploy Script
# Domain: pro-casa.qaspilab.com
# Server: 91.224.74.91
# ============================================
set -e

DOMAIN="pro-casa.qaspilab.com"
APP_DIR="/opt/pro-casa"
REPO="https://github.com/AGGIB/pro-casa.git"
BRANCH="part1"

echo "============================================"
echo "  PRO-CASA Production Deployment"
echo "  Domain: $DOMAIN"
echo "============================================"

# ─────────────────────────────────────────────
# 1. System Update & Dependencies
# ─────────────────────────────────────────────
echo ""
echo "[1/8] Updating system & installing dependencies..."
apt-get update -y
apt-get install -y \
  curl wget git apt-transport-https \
  ca-certificates gnupg lsb-release \
  ufw fail2ban

# ─────────────────────────────────────────────
# 2. Install Docker
# ─────────────────────────────────────────────
echo ""
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed."
else
  echo "Docker already installed: $(docker --version)"
fi

# Install Docker Compose plugin if missing
if ! docker compose version &> /dev/null; then
  apt-get install -y docker-compose-plugin
fi
echo "Docker Compose: $(docker compose version)"

# ─────────────────────────────────────────────
# 3. Firewall Setup
# ─────────────────────────────────────────────
echo ""
echo "[3/8] Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "Firewall configured: SSH, HTTP, HTTPS"

# ─────────────────────────────────────────────
# 4. Clone Repository
# ─────────────────────────────────────────────
echo ""
echo "[4/8] Cloning repository..."
if [ -d "$APP_DIR" ]; then
  echo "Directory exists, pulling latest..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi
echo "Repository ready at $APP_DIR"

# ─────────────────────────────────────────────
# 5. Create .env file
# ─────────────────────────────────────────────
echo ""
echo "[5/8] Creating environment file..."
if [ ! -f "$APP_DIR/deployment/.env.production" ]; then
  echo "ERROR: .env.production not found in deployment/"
  echo "Please create it first!"
  exit 1
fi

# Copy env to deployment directory
cp "$APP_DIR/deployment/.env.production" "$APP_DIR/deployment/.env"
echo ".env created from .env.production"

# ─────────────────────────────────────────────
# 6. SSL Certificate (Let's Encrypt)
# ─────────────────────────────────────────────
echo ""
echo "[6/8] Setting up SSL certificate..."

CERTBOT_DIR="$APP_DIR/deployment/certbot"
mkdir -p "$CERTBOT_DIR/conf" "$CERTBOT_DIR/www"

if [ ! -d "$CERTBOT_DIR/conf/live/$DOMAIN" ]; then
  echo "Obtaining SSL certificate for $DOMAIN..."
  
  # Phase 1: Start temp nginx for ACME challenge
  cat > /tmp/nginx-certbot.conf << 'NGINX_CONF'
events { worker_connections 128; }
http {
    server {
        listen 80;
        server_name pro-casa.qaspilab.com;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'Setting up SSL...'; add_header Content-Type text/plain; }
    }
}
NGINX_CONF

  # Run temporary nginx for certbot
  docker run -d --name nginx-certbot \
    -p 80:80 \
    -v /tmp/nginx-certbot.conf:/etc/nginx/nginx.conf:ro \
    -v "$CERTBOT_DIR/www:/var/www/certbot" \
    nginx:alpine

  sleep 3

  # Get certificate
  docker run --rm \
    -v "$CERTBOT_DIR/conf:/etc/letsencrypt" \
    -v "$CERTBOT_DIR/www:/var/www/certbot" \
    certbot/certbot certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email admin@qaspilab.com \
      --agree-tos \
      --no-eff-email \
      -d "$DOMAIN"

  # Stop temp nginx
  docker stop nginx-certbot && docker rm nginx-certbot
  
  echo "SSL certificate obtained!"
else
  echo "SSL certificate already exists."
fi

# ─────────────────────────────────────────────
# 7. Build & Deploy
# ─────────────────────────────────────────────
echo ""
echo "[7/8] Building and deploying containers..."
cd "$APP_DIR/deployment"

# Stop existing containers
docker compose -f docker-compose.production.yml --env-file .env down 2>/dev/null || true

# Build and start
docker compose -f docker-compose.production.yml --env-file .env build --no-cache
docker compose -f docker-compose.production.yml --env-file .env up -d

echo "Waiting for services to start..."
sleep 15

# ─────────────────────────────────────────────
# 8. Run Prisma Migrations & Seed
# ─────────────────────────────────────────────
echo ""
echo "[8/8] Running database migrations..."

# Wait for postgres
echo "Waiting for PostgreSQL..."
for i in {1..30}; do
  if docker exec pro-casa-db pg_isready -U pro_casa_user -d pro_casa_db > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  sleep 2
done

# Run migrations
docker exec pro-casa-backend npx prisma migrate deploy 2>/dev/null || {
  echo "Running prisma db push as fallback..."
  docker exec pro-casa-backend npx prisma db push --accept-data-loss
}

# Seed data
echo "Seeding database..."
docker exec pro-casa-backend npx prisma db seed 2>/dev/null || {
  echo "Seed via tsx..."
  docker exec pro-casa-backend npx tsx prisma/seed.ts 2>/dev/null || echo "No seed script found, skipping."
}

# ─────────────────────────────────────────────
# Verify
# ─────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "  Services Status:"
docker compose -f docker-compose.production.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  URLs:"
echo "  - Site:    https://$DOMAIN"  
echo "  - API:     https://$DOMAIN/api"
echo "  - Health:  https://$DOMAIN/health"
echo ""
echo "  Useful commands:"
echo "  - Logs:    cd $APP_DIR/deployment && docker compose -f docker-compose.production.yml logs -f"
echo "  - Restart: cd $APP_DIR/deployment && docker compose -f docker-compose.production.yml restart"
echo "  - Update:  cd $APP_DIR && git pull && cd deployment && docker compose -f docker-compose.production.yml up -d --build"
echo "============================================"
