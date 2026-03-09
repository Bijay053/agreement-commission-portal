#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force 2>&1 || echo "Migration warning (may already be applied)"

echo "Starting application..."
exec "$@"
