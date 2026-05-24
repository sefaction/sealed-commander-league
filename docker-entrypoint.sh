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
    npx prisma migrate resolve --rolled-back 20260524140000_card_json_column_type_compat >/dev/null 2>&1 || true
  fi
  npx prisma migrate deploy
fi

if [ "${RUN_SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Seeding..."
  npm run prisma:seed
else
  echo "[entrypoint] Skipping seed (RUN_SEED_ON_START=false)."
fi

echo "[entrypoint] Ensuring admin login exists..."
npm run prisma:bootstrap-admin

echo "[entrypoint] Starting web server..."
exec npm run start
