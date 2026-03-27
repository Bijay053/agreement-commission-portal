#!/bin/bash
set -e

echo "=== Step 1: Install Node.js dependencies ==="
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
fi

npm ci

echo "=== Step 2: Build frontend ==="
rm -rf dist/public
NODE_OPTIONS="--max-old-space-size=2048" npx vite build

echo "=== Step 3: Build Docker image (backend only) ==="
sudo docker compose build --no-cache app

echo "=== Step 4: Start container ==="
sudo docker compose up -d app

echo "=== Done! ==="
