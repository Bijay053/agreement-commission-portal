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
EOF
```

### Step 4: Deploy

```bash
docker-compose up -d --build
```

### Step 5: Set up Nginx + SSL

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
         → Docker Container (port 80)
           → Gunicorn (3 workers, Django WSGI)
             → PostgreSQL (Docker, port 5432)
             → AWS S3 (document storage)
             → AWS SES (email)
```

## Stack

- **Backend**: Python 3.12 + Django 6.0.3 + Django REST Framework
- **Frontend**: React + TypeScript + Vite (pre-built static files served by WhiteNoise)
- **Database**: PostgreSQL 16
- **WSGI Server**: Gunicorn (3 workers)
- **File Storage**: AWS S3 (private bucket)
- **Email**: AWS SES via SMTP
- **PDF Protection**: pikepdf
- **Reverse Proxy**: Nginx with Let's Encrypt SSL

## Deploy Updates

```bash
cd ~/agreement-commission-portal
git pull origin main
docker-compose down
docker-compose up -d --build
```

## Monitoring

```bash
# View logs
docker-compose logs -f app

# Check status
docker-compose ps

# Django shell
docker-compose exec app python manage.py shell

# Database backup
docker-compose exec db pg_dump -U portal_user agreement_portal > backup_$(date +%Y%m%d).sql
```
