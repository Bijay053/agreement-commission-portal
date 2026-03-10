# AWS Deployment Guide — Agreement & Commission Portal (Django)

## Prerequisites

- AWS account with CLI configured (`aws configure`)
- Docker installed locally
- Git repository: https://github.com/Bijay053/agreement-commission-portal

---

## Option 1: AWS EC2 (Recommended for Full Control)

### Step 1: Launch an EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Amazon Linux 2023** or **Ubuntu 22.04**
3. Instance type: **t3.small** (2 vCPU, 2GB RAM) minimum
4. Create or select a key pair for SSH
5. Security Group — allow these inbound rules:
   - **SSH (22)** — your IP only
   - **HTTP (80)** — 0.0.0.0/0
   - **HTTPS (443)** — 0.0.0.0/0

### Step 2: Install Docker on EC2

```bash
# For Amazon Linux 2023
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 3: Clone and Configure

```bash
cd ~
git clone https://github.com/Bijay053/agreement-commission-portal.git
cd agreement-commission-portal

# Create environment file
cat > .env << 'EOF'
DB_PASSWORD=your_strong_database_password
SESSION_SECRET=your_strong_session_secret
ALLOWED_HOSTS=portal.studyinfocentre.com,65.0.18.210
CORS_ORIGINS=https://portal.studyinfocentre.com
CSRF_TRUSTED_ORIGINS=https://portal.studyinfocentre.com

# AWS S3 for documents
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=studyinfocentre-portal-documents

# Email (SES)
SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_ses_smtp_user
SMTP_PASS=your_ses_smtp_password
FROM_EMAIL=noreply@studyinfocentre.com

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn

# PDF download password
PDF_DOWNLOAD_PASSWORD=your_pdf_password
EOF
```

### Step 4: Deploy

```bash
docker-compose up -d --build
```

### Step 5: Run Deploy Check

After the containers are running, verify the production configuration:

```bash
docker-compose exec app python manage.py deploy_check
```

This validates all critical settings (DEBUG, ALLOWED_HOSTS, SECRET_KEY, CSRF, HSTS, database, S3, Sentry).

### Step 6: Set up Nginx + SSL

```bash
sudo yum install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/conf.d/portal.conf << 'EOF'
server {
    listen 80;
    server_name portal.studyinfocentre.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
EOF

sudo systemctl start nginx
sudo certbot --nginx -d portal.studyinfocentre.com
```

---

## Architecture

```
Internet → Nginx (SSL termination, port 443)
         → Docker Container Stack:
           → Nginx (port 80, reverse proxy + static files)
             → Gunicorn (port 5000, Django WSGI, 3 workers)
               → PostgreSQL (Docker, port 5432)
               → Redis (Docker, port 6379) — caching, sessions, Celery broker
               → AWS S3 (document storage)
               → AWS SES (email)
           → Celery Worker (async task processing)
           → Celery Beat (scheduled tasks: expiry checks, session cleanup)
```

## Stack

- **Backend**: Python 3.12 + Django 6.0.3 + Django REST Framework
- **Frontend**: React + TypeScript + Vite (pre-built static files served by WhiteNoise/Nginx)
- **Database**: PostgreSQL 16
- **Cache/Broker**: Redis 7
- **WSGI Server**: Gunicorn (3 workers)
- **Task Queue**: Celery with Redis broker
- **Scheduler**: Celery Beat
- **File Storage**: AWS S3 (private bucket)
- **Email**: AWS SES via SMTP
- **PDF Protection**: pikepdf
- **Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Monitoring**: Sentry (optional), `/api/health` endpoint

## Docker Services (docker-compose.yml)

| Service | Image | Purpose |
|---|---|---|
| `db` | postgres:16-alpine | PostgreSQL database |
| `redis` | redis:7-alpine | Cache, session store, Celery broker |
| `app` | Custom (Dockerfile) | Django/Gunicorn application |
| `nginx` | nginx:1.27-alpine | Reverse proxy, static file serving |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (auto in Docker) | PostgreSQL connection string |
| `DB_PASSWORD` | (required) | Database password |
| `SESSION_SECRET` | (required) | Django secret key |
| `DEBUG` | `False` in Docker | Enable debug mode |
| `ALLOWED_HOSTS` | `portal.studyinfocentre.com` | Comma-separated allowed hostnames |
| `CORS_ORIGINS` | (empty) | Comma-separated allowed CORS origins |
| `CSRF_TRUSTED_ORIGINS` | `https://portal.studyinfocentre.com` | Comma-separated trusted CSRF origins |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection URL |
| `AWS_ACCESS_KEY_ID` | (required) | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | (required) | AWS secret key for S3 |
| `AWS_S3_BUCKET` | `studyinfocentre-portal-documents` | S3 bucket for document storage |
| `AWS_S3_REGION` | `ap-south-1` | AWS region |
| `SMTP_HOST` | `email-smtp.ap-south-1.amazonaws.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | (required for email) | SMTP username |
| `SMTP_PASS` | (required for email) | SMTP password |
| `FROM_EMAIL` | `noreply@studyinfocentre.com` | Sender email address |
| `FROM_NAME` | `Agreement Portal - Study Info Centre` | Sender display name |
| `PORTAL_URL` | `https://portal.studyinfocentre.com` | Portal base URL (for email links) |
| `PDF_DOWNLOAD_PASSWORD` | (set in env) | Password for encrypted PDF downloads |
| `SENTRY_DSN` | (optional) | Sentry error monitoring DSN |
| `AWS_S3_BACKUP_BUCKET` | (optional) | S3 bucket for database backups |
| `AWS_S3_BACKUP_PREFIX` | `backups/db` | S3 key prefix for backup files |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep old backups |

## Security Features

- **CSRF Protection**: All mutating endpoints require CSRF token (pre-auth endpoints exempted)
- **HSTS**: Strict Transport Security with 1-year max-age, including subdomains
- **CSP**: Content Security Policy header in production
- **Rate Limiting**: Anonymous (30/min), authenticated (120/min), login (5/min)
- **File Scanning**: Magic-byte validation + ClamAV integration (when available)
- **Soft Deletes**: Critical records preserved with `is_deleted` flag
- **Audit Trail**: All document operations and status changes logged
- **Session Security**: HTTP-only cookies, same-site Lax, secure in production

## Deploy Updates

```bash
cd ~/agreement-commission-portal
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose exec app python manage.py deploy_check
```

## Monitoring

```bash
# View logs
docker-compose logs -f app

# Check status
docker-compose ps

# Health check
curl http://localhost/api/health

# Django shell
docker-compose exec app python manage.py shell

# Deploy readiness check
docker-compose exec app python manage.py deploy_check
```

## Database Backup & Restore

Automated backup and restore scripts are located in the `scripts/` directory.

### Running a Backup

```bash
# Ensure DATABASE_URL is set
export DATABASE_URL="postgresql://user:pass@host:5432/agreement_portal"

# Local-only backup (no S3)
./scripts/backup.sh

# Backup with S3 upload and rotation
export AWS_S3_BACKUP_BUCKET=studyinfocentre-portal-backups
./scripts/backup.sh
```

The backup script will:
1. Dump the PostgreSQL database using `pg_dump`
2. Compress the dump with gzip
3. Upload to S3 (if bucket is configured) using STANDARD_IA storage class
4. Remove backups older than the retention period (default 30 days)
5. Log all operations to the log file

### Running a Restore

```bash
# Restore from a local file
./scripts/restore.sh /tmp/db_backups/agreement_portal_20250101_120000.sql.gz

# Restore from S3 (downloads automatically)
export AWS_S3_BACKUP_BUCKET=studyinfocentre-portal-backups
./scripts/restore.sh agreement_portal_20250101_120000.sql.gz
```

The restore script will prompt for confirmation before overwriting the database.

### Automated Daily Backups (Cron)

Add a cron job on the EC2 instance to run daily backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM UTC
0 2 * * * DATABASE_URL="postgresql://user:pass@host:5432/agreement_portal" AWS_S3_BACKUP_BUCKET=studyinfocentre-portal-backups /home/ubuntu/agreement-commission-portal/scripts/backup.sh
```

### Docker-Based Backup

If running the database inside Docker:

```bash
# Manual dump via docker-compose
docker-compose exec db pg_dump -U portal_user agreement_portal > backup_$(date +%Y%m%d).sql

# Use the backup script with the Docker database
export DATABASE_URL="postgresql://portal_user:${DB_PASSWORD}@localhost:5432/agreement_portal"
./scripts/backup.sh
```

## Scheduled Tasks (Celery Beat)

The following tasks run automatically via Celery Beat:

| Task | Schedule | Description |
|---|---|---|
| Agreement expiry check | Daily | Sends expiry reminder emails (30d, 14d, 7d, expired) |
| Session cleanup | Daily | Removes expired sessions |
| Password expiry reminders | Daily | Notifies users of upcoming password expiration |

## Export APIs

Data export endpoints for CSV and Excel:

| Endpoint | Formats | Description |
|---|---|---|
| `GET /api/agreements/export` | csv, xlsx | Export agreements list |
| `GET /api/commission-tracker/export` | csv, xlsx | Export commission tracker data |
| `GET /api/audit/export` | csv, xlsx | Export audit logs |

Use `?format=csv` or `?format=xlsx` query parameter.
