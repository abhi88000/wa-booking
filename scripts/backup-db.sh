#!/bin/bash
# ============================================================
# PostgreSQL Daily Backup Script (hardened)
# ============================================================
# Cron entry (3 AM daily):
#   0 3 * * * /home/ubuntu/wa-booking/scripts/backup-db.sh >> /home/ubuntu/db-backups/backup.log 2>&1
#
# - Dumps DB to local gz
# - Verifies the dump is valid gzip and non-trivial size
# - Optional: uploads to S3 if BACKUP_S3_BUCKET is set (off-instance copy)
# - Optional: sends Telegram alert on failure if TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID set
# - Keeps last 7 local backups; S3 lifecycle rules handle remote retention

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-${HOME}/db-backups}"
COMPOSE_FILE="${COMPOSE_FILE:-/home/ubuntu/wa-booking/docker-compose.saas.yml}"
DB_NAME="${DB_NAME:-wa_booking_saas}"
KEEP_DAYS="${KEEP_DAYS:-7}"
MIN_SIZE_BYTES="${MIN_SIZE_BYTES:-1024}"  # alert if dump < 1 KB (something is wrong)

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Source .env so we pick up TELEGRAM_* and BACKUP_S3_BUCKET if defined
if [ -f "$(dirname "$COMPOSE_FILE")/.env" ]; then
  set -a; . "$(dirname "$COMPOSE_FILE")/.env"; set +a
fi

mkdir -p "$BACKUP_DIR"

notify() {
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -sS --max-time 5 \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=$1" \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" > /dev/null || true
  fi
}

on_error() {
  local line=$1
  local msg="DB backup FAILED at line ${line} on $(hostname)"
  echo "[$(date)] $msg"
  notify "$msg"
  exit 1
}
trap 'on_error $LINENO' ERR

echo "[$(date)] Starting backup -> ${BACKUP_FILE}"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U postgres -d "$DB_NAME" --no-owner --no-privileges \
  | gzip > "$BACKUP_FILE"

# Verify dump
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  notify "DB backup CORRUPT (gzip test failed): ${BACKUP_FILE}"
  exit 1
fi
SIZE=$(stat -c%s "$BACKUP_FILE")
if [ "$SIZE" -lt "$MIN_SIZE_BYTES" ]; then
  notify "DB backup TOO SMALL (${SIZE} bytes): ${BACKUP_FILE}"
  exit 1
fi
HUMAN_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Local backup OK (${HUMAN_SIZE})"

# Off-instance copy to S3 (recommended)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if command -v aws > /dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/db-backups/$(basename "$BACKUP_FILE")" \
      --only-show-errors
    echo "[$(date)] Uploaded to s3://${BACKUP_S3_BUCKET}/db-backups/"
  else
    notify "BACKUP_S3_BUCKET set but 'aws' CLI not installed on $(hostname)"
  fi
fi

# Local rotation
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${KEEP_DAYS} -delete
echo "[$(date)] Pruned local backups older than ${KEEP_DAYS} days"

# Weekly success ping so you know the cron itself is alive
DOW=$(date +%u)   # 1=Mon
if [ "$DOW" = "1" ]; then
  notify "Weekly DB backup ping - last backup ${HUMAN_SIZE} on $(hostname)"
fi
