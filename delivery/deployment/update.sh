#!/bin/bash

# PRO.CASA.KZ - Update Script
# This script pulls the latest changes and restarts containers

set -e

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "Pulling latest changes..."
cd "$PROJECT_ROOT"
git pull origin main

echo "Stopping old containers and removing orphans..."
cd "$SCRIPT_DIR" && docker compose -f docker-compose.production.yml down --remove-orphans

echo "Building and restarting containers..."
cd "$SCRIPT_DIR" && docker compose -f docker-compose.production.yml up --build -d

echo "Running prisma migrations..."
docker compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy

echo "Update completed!"
