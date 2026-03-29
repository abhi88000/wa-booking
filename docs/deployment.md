# Production Deployment Guide

## Overview

This guide covers deploying BookingBot SaaS to production. The stack runs on **any VPS** (DigitalOcean, Hetzner, AWS EC2, Azure VM) with Docker installed.

**Recommended minimum specs**: 2 vCPU, 4GB RAM, 40GB SSD (handles ~500 tenants)

## Prerequisites

- Ubuntu 22.04+ (or any Docker-compatible OS)
- Docker Engine 24+ and Docker Compose v2
- Domain name with DNS access
- SSL certificate (we'll use Let's Encrypt)
- SMTP server (for emails — optional)

## Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (v2 is built-in with newer Docker)
docker compose version

# Clone your project
git clone <your-repo-url> /opt/bookingbot
cd /opt/bookingbot
```

## Step 2: Environment Configuration

Create the `.env` file with all production values:

```bash
cp .env.example .env
nano .env
```

### Complete Environment Variables

```env
# ─── Database ───────────────────────────────────────────
DB_USER=bookingbot
DB_PASSWORD=<GENERATE: openssl rand -hex 32>
DB_HOST=postgres
DB_PORT=5432
DB_NAME=wa_booking_saas
DB_POOL_MAX=20

# ─── Redis ──────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── Authentication ────────────────────────────────────
JWT_SECRET=<GENERATE: openssl rand -hex 64>


# ─── WhatsApp (Central Webhook) ───────────────────────
# This is the verify token YOU set — same value goes in Meta webhook config
WA_VERIFY_TOKEN=<GENERATE: openssl rand -hex 16>

# ─── Razorpay (Billing) ──────────────────────────────
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# ─── Application URLs ─────────────────────────────────
APP_URL=https://api.bookingbot.in
CORS_ORIGINS=https://app.bookingbot.in,https://admin.bookingbot.in

# ─── n8n (Optional) ───────────────────────────────────
N8N_USER=admin
N8N_PASSWORD=<GENERATE: openssl rand -hex 16>

# ─── Node Environment ─────────────────────────────────
NODE_ENV=production
PORT=4000
```

## Step 3: DNS Configuration

Set up the following DNS records (A records pointing to your server IP):

| Subdomain | Purpose |
|---|---|
| `api.bookingbot.in` | Backend API + WhatsApp webhook |
| `app.bookingbot.in` | Tenant dashboard |
| `admin.bookingbot.in` | Super admin panel |
| `n8n.bookingbot.in` | n8n (optional) |

## Step 4: SSL with Nginx Reverse Proxy

Create an Nginx reverse proxy with Let's Encrypt SSL:

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Get certificates
sudo certbot --nginx -d api.bookingbot.in -d app.bookingbot.in -d admin.bookingbot.in
```

Create Nginx config:

```nginx
# /etc/nginx/sites-available/bookingbot

# Backend API
server {
    listen 443 ssl http2;
    server_name api.bookingbot.in;

    ssl_certificate /etc/letsencrypt/live/api.bookingbot.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bookingbot.in/privkey.pem;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Tenant Dashboard
server {
    listen 443 ssl http2;
    server_name app.bookingbot.in;

    ssl_certificate /etc/letsencrypt/live/app.bookingbot.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.bookingbot.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Super Admin Panel
server {
    listen 443 ssl http2;
    server_name admin.bookingbot.in;

    ssl_certificate /etc/letsencrypt/live/admin.bookingbot.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.bookingbot.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.bookingbot.in app.bookingbot.in admin.bookingbot.in;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bookingbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Build & Launch

```bash
cd /opt/bookingbot

# Build and start all services
docker compose -f docker-compose.saas.yml up -d --build

# Check all services are running
docker compose -f docker-compose.saas.yml ps

# Check logs
docker compose -f docker-compose.saas.yml logs -f backend
```

## Step 6: Initialize Platform Admin

```bash
# Generate a bcrypt password hash
docker compose -f docker-compose.saas.yml exec backend \
  node -e "require('bcrypt').hash('YourSecurePassword',10).then(h=>console.log(h))"

# Update the seed admin password
docker compose -f docker-compose.saas.yml exec postgres \
  psql -U bookingbot -d wa_booking_saas -c \
  "UPDATE platform_admins SET password_hash = '\$2b\$10\$YOUR_HASH' WHERE email = 'superadmin@bookingbot.com';"
```

## Step 7: Configure WhatsApp Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select your app → WhatsApp → Configuration
3. Set webhook URL: `https://api.bookingbot.in/webhook/whatsapp`
4. Set verify token: (same as `WA_VERIFY_TOKEN` in .env)
5. Subscribe to: `messages`
6. Click "Verify and Save"

## Step 8: Verify Everything

```bash
# Health check
curl https://api.bookingbot.in/health

# Check database
docker compose -f docker-compose.saas.yml exec postgres \
  psql -U bookingbot -d wa_booking_saas -c "SELECT COUNT(*) FROM tenants;"

# Test WhatsApp webhook verification
curl "https://api.bookingbot.in/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Should return: test123
```

## Backup Strategy

### Automated Daily Backups

```bash
# Create backup script
cat > /opt/bookingbot/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/bookingbot"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
docker compose -f /opt/bookingbot/docker-compose.saas.yml exec -T postgres \
  pg_dump -U bookingbot wa_booking_saas | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$TIMESTAMP.sql.gz"
EOF

chmod +x /opt/bookingbot/scripts/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/bookingbot/scripts/backup.sh >> /var/log/bookingbot-backup.log 2>&1") | crontab -
```

### Restore from Backup

```bash
gunzip < /opt/backups/bookingbot/db_20250101_020000.sql.gz | \
  docker compose -f docker-compose.saas.yml exec -T postgres \
  psql -U bookingbot wa_booking_saas
```

## Monitoring

### Basic Health Monitoring

```bash
# Add to crontab (every 5 minutes)
cat > /opt/bookingbot/scripts/healthcheck.sh << 'EOF'
#!/bin/bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.bookingbot.in/health)
if [ "$STATUS" != "200" ]; then
  echo "ALERT: BookingBot API down! Status: $STATUS" | mail -s "BookingBot Down" you@email.com
  docker compose -f /opt/bookingbot/docker-compose.saas.yml restart backend
fi
EOF
```

### Log Monitoring

```bash
# View real-time backend logs
docker compose -f docker-compose.saas.yml logs -f backend --tail 100

# View cron worker logs
docker compose -f docker-compose.saas.yml logs -f cron-worker --tail 100

# View all service status
docker compose -f docker-compose.saas.yml ps
```

## Updating / Deploying New Versions

```bash
cd /opt/bookingbot

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime for frontends)
docker compose -f docker-compose.saas.yml up -d --build

# If database schema changed, run migrations:
docker compose -f docker-compose.saas.yml exec postgres \
  psql -U bookingbot -d wa_booking_saas -f /path/to/migration.sql
```

## Cost Estimates

| Component | Provider | Monthly Cost |
|---|---|---|
| VPS (2 vCPU, 4GB) | DigitalOcean / Hetzner | $12-24 |
| Domain | Any registrar | ~$1 |
| WhatsApp API | Meta | Free (each tenant pays own) |
| **Total platform cost** | | **~$13-25/mo** |

At ₹999/mo starter plan with just 20 paying customers = ₹19,980/mo revenue (~$240).

## Production Checklist

- [ ] Strong passwords for DB, JWT, admin accounts
- [ ] SSL certificates configured and auto-renewing
- [ ] WhatsApp webhook verified and working
- [ ] Platform admin account created with real password
- [ ] Database backups automated
- [ ] Health monitoring configured
- [ ] CORS origins set to actual domains
- [ ] Rate limiting tested
- [ ] Log rotation configured
- [ ] Firewall: only ports 80, 443, 22 exposed
- [ ] Redis password set (if exposed)
- [ ] n8n protected with strong credentials (or disabled)
