#!/bin/sh
set -e

echo "Pushing database schema..."
echo "No" | npx drizzle-kit push --force --dialect postgresql --schema ./server/db/schema/index.ts --url "$DATABASE_URL" || true

echo "Starting server..."
exec node dist/server/index.js
