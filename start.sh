#!/bin/sh
set -e

echo "Pushing database schema..."
npx drizzle-kit push --force --dialect postgresql --schema ./server/db/schema/index.ts --url "$DATABASE_URL"

echo "Starting server..."
exec node dist/server/index.js
