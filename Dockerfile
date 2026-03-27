FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl qpdf libmagic1 && \
    rm -rf /var/lib/apt/lists/*

FROM base AS python-deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

FROM python-deps AS frontend-build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY client/ ./client/
COPY shared/ ./shared/
COPY vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js components.json ./
RUN mkdir -p attached_assets
RUN NODE_OPTIONS="--max-old-space-size=2048" npx vite build

FROM base AS production
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin
COPY backend/ ./backend/
COPY --from=frontend-build /app/dist/public ./dist/public
COPY scripts/ ./scripts/
RUN mkdir -p uploads

ENV DJANGO_SETTINGS_MODULE=config.settings
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

WORKDIR /app/backend
CMD bash -c "python -c \"import django; django.setup(); from django.db import connection; cursor = connection.cursor(); cursor.execute(open('/app/scripts/ensure_schema.sql').read()); print('Schema ensured.')\" 2>/dev/null || true; exec gunicorn config.wsgi:application --bind 0.0.0.0:5000 --workers 3 --timeout 120 --access-logfile -"
