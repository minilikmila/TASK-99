#!/bin/sh
set -e

# Wait for MySQL to accept TCP connections. The compose healthcheck
# (mysqladmin ping) can pass before the TCP socket is ready.
echo "[entrypoint] Waiting for database at db:3306..."
MAX_ATTEMPTS=30
ATTEMPT=0
while ! mysqladmin ping -h db -P 3306 --silent 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] ERROR: database not reachable after ${MAX_ATTEMPTS}s" >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] Database is ready."

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Seeding default data (idempotent)..."
npx ts-node --project tsconfig.scripts.json scripts/seed.ts

echo "[entrypoint] Starting CivicForum Operations Platform..."
exec node dist/server.js
