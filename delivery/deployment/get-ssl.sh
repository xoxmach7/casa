#!/bin/bash
set -e

# Setup dirs
mkdir -p /opt/pro-casa/deployment/certbot/conf /opt/pro-casa/deployment/certbot/www

# Create temp nginx config
cat > /tmp/certbot-nginx.conf << 'NGINXCONF'
events { worker_connections 128; }
http {
    server {
        listen 80;
        server_name pro-casa.qaspilab.com;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'Setting up SSL...'; add_header Content-Type text/plain; }
    }
}
NGINXCONF

# Stop existing containers if any
docker rm -f nginx-certbot 2>/dev/null || true

# Start temp nginx
docker run -d --name nginx-certbot \
  -p 80:80 \
  -v /tmp/certbot-nginx.conf:/etc/nginx/nginx.conf:ro \
  -v /opt/pro-casa/deployment/certbot/www:/var/www/certbot \
  nginx:alpine

sleep 3
echo "Temp nginx started"
curl -s http://localhost && echo ""

# Get SSL certificate
docker run --rm \
  -v /opt/pro-casa/deployment/certbot/conf:/etc/letsencrypt \
  -v /opt/pro-casa/deployment/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@qaspilab.com \
    --agree-tos \
    --no-eff-email \
    -d pro-casa.qaspilab.com

# Cleanup temp nginx
docker stop nginx-certbot && docker rm nginx-certbot
echo "SSL certificate obtained successfully!"
ls -la /opt/pro-casa/deployment/certbot/conf/live/pro-casa.qaspilab.com/
