#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "DATABASE RESET & MIGRATION"
echo "=========================================="

# Step 1: Stop and remove volumes
echo ""
echo "Stopping containers and clearing volumes..."
docker-compose down -v

# Step 2: Start containers
echo ""
echo "Starting containers..."
docker-compose up -d

# Step 3: Wait for database to be ready
echo ""
echo "Waiting for database to be ready..."
sleep 5

# Check if backend is ready
echo "Waiting for backend to be ready..."
until docker-compose exec -T backend npm run db:status > /dev/null 2>&1; do
  echo "   Backend not ready yet, waiting..."
  sleep 2
done

# Step 4: Run migrations
echo ""
echo "Running migrations..."
docker-compose exec -T backend npm run db:migrate 2>&1 | grep -v "CREATE\|DROP\|INSERT\|NOTICE\|ALTER" | grep -E "Applying:|Applied:|Failed:|Error:|error" || echo "  Migrations applied successfully"

# Step 5: Seed admin user (if env vars are set)
echo ""
echo "Seeding admin user..."
if docker-compose exec -T backend npm run seed:admin 2>&1 | grep -q "ERROR"; then
  echo "  Skipped - ensure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env"
else
  echo "  Admin user ready"
fi

echo ""
echo "=========================================="
echo "DATABASE RESET COMPLETE!"
echo "=========================================="
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5001"
echo ""
