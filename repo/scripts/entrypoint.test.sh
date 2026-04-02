#!/bin/sh
# Test container entrypoint: migrate → seed test data → start server
set -e

echo "[entrypoint.test] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint.test] Seeding test data..."
npx ts-node --project tsconfig.scripts.json scripts/seed-test.ts

echo "[entrypoint.test] Starting server..."
exec node dist/server.js
