#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."

if [ "${WIPE_DB_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] WIPE_DB_ON_START=true -> resetting database (destructive)."
  npx prisma migrate reset --force --skip-generate
else
  if [ "${AUTO_RESOLVE_FAILED_MIGRATION:-true}" = "true" ]; then
    # Helps recover from P3009 when a previous migration attempt is marked failed.
    npx prisma migrate resolve --rolled-back 20260522120000_admin_setup >/dev/null 2>&1 || true
  fi
  npx prisma migrate deploy
fi

echo "[entrypoint] Seeding..."
npm run prisma:seed

echo "[entrypoint] Starting web server..."
exec npm run start
