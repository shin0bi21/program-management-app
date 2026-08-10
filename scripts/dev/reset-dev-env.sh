#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "DEV STACK RESET & MIGRATION"
echo "=========================================="

# Remove the current containers and all disposable development volumes.
echo ""
echo "Stopping containers and clearing volumes..."
docker compose down -v

# Rebuild images and start a fresh stack.
echo ""
echo "Starting containers..."
docker compose up -d --build

# Wait until the rebuilt backend is ready to accept commands.
echo ""
echo "Waiting for database to be ready..."
sleep 5

echo "Waiting for backend to be ready..."
until docker compose exec -T backend curl -fsS http://localhost:5001/health > /dev/null 2>&1; do
  echo "   Backend not ready yet, waiting..."
  sleep 2
done

# Apply migrations to both development and test databases.
echo ""
echo "Running migrations (dev DB)..."
docker compose exec -T backend npm run db:migrate

echo ""
echo "Running migrations (test DB)..."
docker compose exec -T backend npm run db:migrate:test

# Seed the configured admin and deterministic demo records.
echo ""
echo "Seeding admin user..."
if docker compose exec -T backend npm run seed:admin 2>&1; then
  echo "  Admin user ready"
else
  echo "  Skipped - ensure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env"
fi

echo ""
echo "Seeding programming demo data..."
docker compose exec -T backend npm run seed:programming-demo

echo ""
echo "Seeding Timesheet demo data..."
docker compose exec -T backend npm run seed:timesheet-demo

# Regenerate TypeScript database types from the live schema.
echo ""
echo "Regenerating database types..."
docker compose exec -T backend npm run db:types 2>&1 && echo "  Types regenerated" || echo "  Warning: db:types failed - check kysely-codegen config"

echo ""
echo "=========================================="
echo "DEV STACK RESET COMPLETE!"
echo "=========================================="
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5001"
echo ""
