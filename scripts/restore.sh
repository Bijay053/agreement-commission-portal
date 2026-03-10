#!/usr/bin/env bash
set -euo pipefail

S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-}"
S3_PREFIX="${AWS_S3_BACKUP_PREFIX:-backups/db}"
RESTORE_DIR="${RESTORE_DIR:-/tmp/db_restores}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/db_backup.log}"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

usage() {
  echo "Usage: $0 <backup_file_or_s3_key>"
  echo ""
  echo "Restore a PostgreSQL backup to the database specified by DATABASE_URL."
  echo ""
  echo "Arguments:"
  echo "  backup_file_or_s3_key   Local .sql.gz file path, or S3 object key"
  echo ""
  echo "Examples:"
  echo "  $0 /tmp/db_backups/agreement_portal_20250101_120000.sql.gz"
  echo "  $0 agreement_portal_20250101_120000.sql.gz   (downloads from S3)"
  echo ""
  echo "Environment variables:"
  echo "  DATABASE_URL               PostgreSQL connection string (required)"
  echo "  AWS_S3_BACKUP_BUCKET       S3 bucket name for remote backups"
  echo "  AWS_S3_BACKUP_PREFIX       S3 key prefix (default: backups/db)"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

BACKUP_SOURCE="$1"

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

mkdir -p "$RESTORE_DIR"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/dev/null"

if [ -f "$BACKUP_SOURCE" ]; then
  RESTORE_FILE="$BACKUP_SOURCE"
  log "Using local backup file: ${RESTORE_FILE}"
elif [ -n "$S3_BUCKET" ]; then
  if [[ "$BACKUP_SOURCE" == s3://* ]]; then
    S3_PATH="$BACKUP_SOURCE"
  elif [[ "$BACKUP_SOURCE" == */* ]]; then
    S3_PATH="s3://${S3_BUCKET}/${BACKUP_SOURCE}"
  else
    S3_PATH="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_SOURCE}"
  fi

  RESTORE_FILE="${RESTORE_DIR}/$(basename "$BACKUP_SOURCE")"
  log "Downloading backup from ${S3_PATH}"
  aws s3 cp "$S3_PATH" "$RESTORE_FILE"

  if [ $? -ne 0 ]; then
    log "ERROR: Failed to download backup from S3"
    exit 1
  fi
  log "Download complete: ${RESTORE_FILE}"
else
  log "ERROR: Backup file not found locally and S3 bucket not configured"
  exit 1
fi

if [[ ! "$RESTORE_FILE" == *.sql.gz ]] && [[ ! "$RESTORE_FILE" == *.sql ]]; then
  log "ERROR: Backup file must be .sql or .sql.gz"
  exit 1
fi

echo ""
echo "============================================"
echo "  WARNING: This will overwrite the database"
echo "============================================"
echo ""
echo "Backup file: ${RESTORE_FILE}"
echo "Database:    ${DATABASE_URL%%@*}@..."
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  log "Restore cancelled by user"
  exit 0
fi

log "Starting database restore from: ${RESTORE_FILE}"

if [[ "$RESTORE_FILE" == *.sql.gz ]]; then
  gunzip -c "$RESTORE_FILE" | psql "$DATABASE_URL" --single-transaction
else
  psql "$DATABASE_URL" --single-transaction -f "$RESTORE_FILE"
fi

if [ $? -eq 0 ]; then
  log "Database restore completed successfully"
else
  log "ERROR: Database restore failed"
  exit 1
fi

if [[ "$RESTORE_FILE" == "${RESTORE_DIR}/"* ]]; then
  rm -f "$RESTORE_FILE"
  log "Cleaned up temporary download"
fi

log "Restore process finished"
exit 0
