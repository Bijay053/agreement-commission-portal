#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force 2>&1 || echo "Migration warning (may already be applied)"

echo "Starting application..."
exec node -e "
process.on('uncaughtException', (e) => {
  console.error('===== CRASH ERROR =====');
  console.error('Type:', e.constructor.name);
  console.error('Message:', e.message);
  console.error('Stack:', e.stack);
  console.error('=======================');
  process.exit(1);
});
require('./dist/index.cjs');
"
