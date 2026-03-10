FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl qpdf && \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

FROM deps AS build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY . .
RUN npx vite build

FROM base AS production
RUN pip install --no-cache-dir gunicorn
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY --from=build /app/backend ./backend
COPY --from=build /app/dist/public ./dist/public
RUN mkdir -p uploads

ENV DJANGO_SETTINGS_MODULE=config.settings
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

WORKDIR /app/backend
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:5000", "--workers", "3", "--timeout", "120", "--access-logfile", "-"]
