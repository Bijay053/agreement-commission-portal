#!/bin/bash
set -e
npm install
cd backend && python manage.py migrate --no-input
