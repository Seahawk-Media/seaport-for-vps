#!/bin/sh
set -e

# Push schema changes (timeout after 30s to avoid interactive prompt hangs)
echo "Pushing database schema..."
timeout 30 npx drizzle-kit push --force --dialect postgresql --schema ./server/db/schema/index.ts --url "$DATABASE_URL" 2>&1 || echo "Schema push skipped (tables likely already exist)"

echo "Starting server..."
exec node dist/server/index.js
