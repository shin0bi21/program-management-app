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

# ── Users suite (GET/POST users, permissions)
echo ""
echo "── Users Suite ──────────────────────────"
docker-compose exec -T backend npm run test:users

echo ""
echo "=========================================="
echo "All test suites passed!"
echo "=========================================="
