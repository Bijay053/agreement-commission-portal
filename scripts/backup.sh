#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/db_backups}"
S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-}"
S3_PREFIX="${AWS_S3_BACKUP_PREFIX:-backups/db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/db_backup.log}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="agreement_portal_${TIMESTAMP}.sql.gz"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

cleanup() {
  if [ -f "${BACKUP_DIR}/${BACKUP_FILENAME}" ]; then
    rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}"
  fi
}
trap cleanup ERR

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/dev/null"

log "Starting database backup: ${BACKUP_FILENAME}"

pg_dump "$DATABASE_URL" --no-owner --no-privileges --clean --if-exists \
  | gzip > "${BACKUP_DIR}/${BACKUP_FILENAME}"

BACKUP_SIZE=$(stat -f%z "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>/dev/null \
  || stat -c%s "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>/dev/null \
  || echo "unknown")
log "Backup created: ${BACKUP_DIR}/${BACKUP_FILENAME} (${BACKUP_SIZE} bytes)"

if [ -n "$S3_BUCKET" ]; then
  log "Uploading backup to s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILENAME}"
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILENAME}" \
    "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILENAME}" \
    --storage-class STANDARD_IA

  if [ $? -eq 0 ]; then
    log "Upload successful"
  else
    log "ERROR: Upload to S3 failed"
    exit 1
  fi

  log "Rotating old backups (removing files older than ${RETENTION_DAYS} days)"
  CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%dT00:00:00 2>/dev/null \
    || date -v-${RETENTION_DAYS}d +%Y-%m-%dT00:00:00 2>/dev/null \
    || "")

  if [ -n "$CUTOFF_DATE" ]; then
    aws s3api list-objects-v2 \
      --bucket "$S3_BUCKET" \
      --prefix "$S3_PREFIX/" \
      --query "Contents[?LastModified<'${CUTOFF_DATE}'].Key" \
      --output text 2>/dev/null | tr '\t' '\n' | while read -r key; do
        if [ -n "$key" ] && [ "$key" != "None" ]; then
          log "Deleting old backup: s3://${S3_BUCKET}/${key}"
          aws s3 rm "s3://${S3_BUCKET}/${key}"
        fi
      done
    log "Rotation complete"
  else
    log "WARNING: Could not compute cutoff date for rotation"
  fi
else
  log "S3 bucket not configured; backup stored locally only"
  log "Rotating local backups older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -name "agreement_portal_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
fi

rm -f "${BACKUP_DIR}/${BACKUP_FILENAME}" 2>/dev/null || true

log "Backup completed successfully"
exit 0
