#!/bin/bash
set -e
cd "$(dirname "$0")/.." || exit

source scripts/_docker-health.sh

echo ""
echo "=========================================="
echo "Running ALL test suites"
echo "=========================================="

# ── Auth suite (login, 2FA, resend, refresh, logout, password-reset, full flow)
echo ""
echo "── Auth Suite ───────────────────────────"
docker-compose exec -T backend npm run test:auth

# ── Staff suite (GET/POST/PATCH/DELETE staff users, permissions)
echo ""
echo "── Staff Suite ──────────────────────────"
docker-compose exec -T backend npm run test:staff

# ── Youth suite (GET/POST/PATCH/DELETE youth, addresses, contacts)
echo ""
echo "── Youth Suite ──────────────────────────"
docker-compose exec -T backend npm run test:youth

echo ""
echo "=========================================="
echo "All test suites passed!"
echo "=========================================="
