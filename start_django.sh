#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Starting Django backend on port 5001..."
cd backend
python manage.py runserver 0.0.0.0:5001 --noreload &
DJANGO_PID=$!
cd ..

sleep 2

echo "Starting Vite dev server on port 5000..."
npx vite --host 0.0.0.0 --port 5000 &
VITE_PID=$!

cleanup() {
    echo "Shutting down..."
    kill $DJANGO_PID 2>/dev/null || true
    kill $VITE_PID 2>/dev/null || true
    wait
}

trap cleanup EXIT INT TERM

wait
