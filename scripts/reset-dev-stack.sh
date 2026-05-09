#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "DEV STACK RESET & MIGRATION"
echo "=========================================="

# Step 1: Stop and remove volumes
echo ""
echo "Stopping containers and clearing volumes..."
docker-compose down -v

# Step 2: Rebuild images and start containers
echo ""
echo "Starting containers..."
docker-compose up -d --build

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
echo "Running migrations (dev DB)..."
docker-compose exec -T backend npm run db:migrate 2>&1 | grep -v "CREATE\|DROP\|INSERT\|NOTICE\|ALTER" | grep -E "Applying:|Applied:|Failed:|Error:|error" || echo "  Migrations applied successfully"

# Step 4b: Run migrations against the test DB (tmpfs, fresh on every restart)
echo ""
echo "Running migrations (test DB)..."
docker-compose exec -T backend npm run db:migrate:test 2>&1 | grep -v "CREATE\|DROP\|INSERT\|NOTICE\|ALTER" | grep -E "Applying:|Applied:|Failed:|Error:|error" || echo "  Test DB migrations applied successfully"

# Step 5: Seed admin user (if env vars are set)
echo ""
echo "Seeding admin user..."
if docker-compose exec -T backend npm run seed:admin 2>&1 | grep -q "ERROR"; then
  echo "  Skipped - ensure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env"
else
  echo "  Admin user ready"
fi

# Step 6: Generate backup migration from live schema
echo ""
echo "Generating backup migration..."
docker-compose exec -T backend npm run db:generate-backup 2>&1 | grep -E "Generated:|Tables to process:|Error:|error|COMPLETE" || echo "  Backup migration generated"

# Step 7: Apply backup migration
echo ""
echo "Applying backup migration..."
docker-compose exec -T backend npm run db:migrate 2>&1 | grep -v "CREATE\|DROP\|INSERT\|NOTICE\|ALTER" | grep -E "Applying:|Applied:|Failed:|Error:|error" || echo "  Backup migration applied successfully"

# Step 8: Regenerate TypeScript types from live DB (includes backup tables)
echo ""
echo "Regenerating database types..."
docker-compose exec -T backend npm run db:types 2>&1 && echo "  Types regenerated" || echo "  Warning: db:types failed - check kysely-codegen config"

echo ""
echo "=========================================="
echo "DEV STACK RESET COMPLETE!"
echo "=========================================="
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5001"
echo ""
