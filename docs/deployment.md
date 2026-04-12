# Production Deployment Guide

Covers deploying the WhatsApp booking platform to a VPS with Docker. Written for Ubuntu on AWS EC2 but should work on any Linux box with Docker.

Minimum specs: 2 vCPU, 4 GB RAM, 40 GB disk.

## Prerequisites

- Ubuntu 22.04 or later
- Docker Engine 24+ with Compose v2
- A domain with DNS access
- SSH access to the server

## 1. Server Setup

```bash
sudo apt update && sudo apt upgrade -y

# install docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# verify
docker compose version

# clone the repo
git clone git@github.com:youruser/wa-booking.git /home/ubuntu/wa-booking
cd /home/ubuntu/wa-booking
```

## 2. Environment Variables

Create a `.env` in the project root:

```bash
cp .env.example .env
nano .env
```

The four variables that matter:

```env
DB_USER=postgres
DB_PASSWORD=<generate a strong password>
JWT_SECRET=<generate with: openssl rand -hex 32>
WA_VERIFY_TOKEN=<any random string — same value goes in Meta webhook config>
```

Everything else (DB_HOST, REDIS_URL, APP_URL, CORS_ORIGINS) has sensible defaults in `docker-compose.saas.yml`.

## 3. DNS Records

Point these A records to your server's public IP:

| Subdomain | Purpose |
|---|---|
| `api.yourdomain.com` | Backend API + WhatsApp webhook |
| `book.yourdomain.com` | Tenant dashboard |
| `hub.yourdomain.com` | Super admin panel |

## 4. Nginx + SSL

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com -d book.yourdomain.com -d hub.yourdomain.com
```

Example Nginx config (`/etc/nginx/sites-available/wa-booking`):

```nginx
# Backend API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

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
    server_name book.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/book.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/book.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Super Admin
server {
    listen 443 ssl http2;
    server_name hub.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/hub.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hub.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# redirect HTTP
server {
    listen 80;
    server_name api.yourdomain.com book.yourdomain.com hub.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wa-booking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Build and Start

```bash
cd /home/ubuntu/wa-booking
docker compose -f docker-compose.saas.yml up -d --build
```

Check everything came up:

```bash
docker compose -f docker-compose.saas.yml ps
docker compose -f docker-compose.saas.yml logs -f backend
```

## 6. Create the Platform Admin

Connect to the database and insert an admin user. You can do this through pgAdmin or from the command line:

```bash
docker compose -f docker-compose.saas.yml exec postgres \
  psql -U postgres -d wa_booking_saas -c \
  "INSERT INTO platform_admins (id, email, password_hash, name, role)
   VALUES (gen_random_uuid(), 'admin@yourdomain.com',
           crypt('yourpassword', gen_salt('bf', 10)),
           'Admin', 'super_admin');"
```

Then log in at `https://hub.yourdomain.com`.

## 7. Configure WhatsApp Webhook

1. Open [Meta Developer Console](https://developers.facebook.com/)
2. Go to your app > WhatsApp > Configuration
3. Set webhook URL: `https://api.yourdomain.com/api/webhook`
4. Set verify token: same value as `WA_VERIFY_TOKEN` in your `.env`
5. Subscribe to: `messages`
6. Click Verify and Save

## 8. Verify

```bash
# health check
curl https://api.yourdomain.com/health

# webhook verification (should echo back the challenge)
curl "https://api.yourdomain.com/api/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

## Deploying Updates

```bash
cd /home/ubuntu/wa-booking
git pull origin main
docker compose -f docker-compose.saas.yml up -d --build backend cron-worker tenant-dashboard super-admin
```

Only the services you name get rebuilt. Postgres and Redis keep running.

## Backups

Simple cron-based daily backup:

```bash
#!/bin/bash
# /home/ubuntu/wa-booking/scripts/backup.sh
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose -f /home/ubuntu/wa-booking/docker-compose.saas.yml exec -T postgres \
  pg_dump -U postgres wa_booking_saas | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

Add to crontab: `0 2 * * * /home/ubuntu/wa-booking/scripts/backup.sh`

Restore:

```bash
gunzip < /home/ubuntu/backups/db_20250101_020000.sql.gz | \
  docker compose -f docker-compose.saas.yml exec -T postgres \
  psql -U postgres wa_booking_saas
```

## Logs

```bash
# backend logs
docker compose -f docker-compose.saas.yml logs -f backend --tail 100

# cron worker
docker compose -f docker-compose.saas.yml logs -f cron-worker --tail 100

# everything
docker compose -f docker-compose.saas.yml ps
```

## Production Checklist

- [ ] Strong JWT_SECRET and DB password
- [ ] SSL certificates auto-renewing (certbot handles this)
- [ ] WhatsApp webhook verified
- [ ] Platform admin account created
- [ ] Database backups scheduled
- [ ] Firewall: only ports 22, 80, 443 open
- [ ] Elastic IP attached (so IP doesn't change on reboot)
