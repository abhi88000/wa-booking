#!/bin/bash
# ============================================================
# PostgreSQL Daily Backup Script
# ============================================================
# Usage: Add to crontab on EC2:
#   0 3 * * * /home/ubuntu/wa-booking/scripts/backup-db.sh
#
# Keeps last 7 daily backups. Stores in ~/db-backups/

set -euo pipefail

BACKUP_DIR="${HOME}/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/wa_booking_saas_${TIMESTAMP}.sql.gz"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump via Docker
docker compose -f /home/ubuntu/wa-booking/docker-compose.saas.yml exec -T postgres \
  pg_dump -U postgres -d wa_booking_saas --no-owner --no-privileges \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Remove backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "wa_booking_saas_*.sql.gz" -mtime +${KEEP_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${KEEP_DAYS} days"

# List current backups
echo "Current backups:"
ls -lh "$BACKUP_DIR"/wa_booking_saas_*.sql.gz 2>/dev/null || echo "  (none)"
