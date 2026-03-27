FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl qpdf libmagic1 && \
    rm -rf /var/lib/apt/lists/*

FROM base AS python-deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

FROM base AS production
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin
COPY backend/ ./backend/
COPY dist/public ./dist/public
COPY scripts/ ./scripts/
RUN mkdir -p uploads

ENV DJANGO_SETTINGS_MODULE=config.settings
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

WORKDIR /app/backend
CMD bash -c "python manage.py collectstatic --noinput 2>/dev/null || true; python -c \"import django; django.setup(); from django.db import connection; cursor = connection.cursor(); cursor.execute(open('/app/scripts/ensure_schema.sql').read()); print('Schema ensured.')\" 2>/dev/null || true; exec gunicorn config.wsgi:application --bind 0.0.0.0:5000 --workers 3 --timeout 120 --access-logfile -"
