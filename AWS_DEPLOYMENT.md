# AWS Deployment Guide — Agreement & Commission Portal

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
6. Storage: 20GB minimum

### Step 2: Connect and Install Docker

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip

# Amazon Linux 2023
sudo yum update -y
sudo yum install -y docker git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes
exit
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### Step 3: Deploy the Application

```bash
git clone https://github.com/Bijay053/agreement-commission-portal.git
cd agreement-commission-portal

# Create environment file
cp .env.example .env

# Edit with strong passwords
nano .env
# Set:
#   DB_PASSWORD=your_strong_password_here
#   SESSION_SECRET=your_random_64_char_string
#   DATABASE_URL=postgresql://portal_user:your_strong_password_here@db:5432/agreement_portal

# Start the application
docker-compose up -d --build

# Check logs
docker-compose logs -f app
```

### Step 4: Initialize the Database

```bash
# Run database migrations
docker-compose exec app node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => console.log('DB connected')).catch(console.error);
"

# Push the schema (run from host with Node.js, or exec into container)
docker-compose exec app npx drizzle-kit push
```

The seed script runs automatically on first startup and creates the default admin user.

### Step 5: Set Up HTTPS with Nginx (Optional but Recommended)

```bash
sudo yum install -y nginx certbot python3-certbot-nginx

# Configure Nginx as reverse proxy
sudo tee /etc/nginx/conf.d/portal.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo systemctl start nginx
sudo systemctl enable nginx

# Get SSL certificate (requires domain pointing to EC2 IP)
sudo certbot --nginx -d your-domain.com
```

---

## Option 2: AWS Elastic Beanstalk (Easiest AWS Option)

### Step 1: Install EB CLI

```bash
pip install awsebcli
```

### Step 2: Initialize and Deploy

```bash
cd agreement-commission-portal

# Initialize Elastic Beanstalk
eb init -p docker agreement-portal --region us-east-1

# Create an environment with a database
eb create agreement-portal-prod \
  --database \
  --database.engine postgres \
  --database.instance db.t3.micro \
  --database.username portal_user \
  --database.password YOUR_STRONG_PASSWORD \
  --instance_type t3.small

# Set environment variables
eb setenv \
  SESSION_SECRET=your_random_64_char_string \
  NODE_ENV=production \
  PORT=5000
```

Note: Elastic Beanstalk automatically sets `DATABASE_URL` from the RDS instance.

### Step 3: Deploy Updates

```bash
eb deploy
```

---

## Option 3: AWS ECS with Fargate (Serverless Containers)

### Step 1: Push Docker Image to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name agreement-portal --region us-east-1

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t agreement-portal .
docker tag agreement-portal:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/agreement-portal:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/agreement-portal:latest
```

### Step 2: Create RDS PostgreSQL

1. Go to **AWS Console → RDS → Create Database**
2. Choose **PostgreSQL 16**
3. Instance: **db.t3.micro** (free tier eligible)
4. Set username/password
5. Note the endpoint URL

### Step 3: Create ECS Service

1. Go to **AWS Console → ECS → Create Cluster** (Fargate)
2. Create a Task Definition with:
   - Image: your ECR image URL
   - Port: 5000
   - Environment variables:
     - `DATABASE_URL`: your RDS connection string
     - `SESSION_SECRET`: your secret
     - `NODE_ENV`: production
     - `PORT`: 5000
   - Memory: 1024 MB
   - CPU: 512
3. Create a Service with an Application Load Balancer

---

## Default Login Credentials

After deployment, log in with:

- **Admin**: admin@studyinfocentre.com / admin123
- **Editor**: editor@studyinfocentre.com / editor123
- **Viewer**: viewer@studyinfocentre.com / viewer123

**IMPORTANT**: Change these passwords immediately after first login.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | Set to `production` for deployment |

---

## Updating the Application

```bash
# Pull latest code
cd agreement-commission-portal
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

---

## Troubleshooting

- **Container won't start**: Check logs with `docker-compose logs app`
- **Database connection fails**: Verify `DATABASE_URL` is correct and database is running
- **Port already in use**: Change the port mapping in `docker-compose.yml`
- **File uploads not persisting**: Ensure the `uploads` volume is properly mounted
