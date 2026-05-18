#!/bin/bash
# Database Backup Script
# Backs up PostgreSQL database from Docker container, compresses, and optionally uploads to S3

set -eo pipefail  # Exit on error; fail pipeline if any command in pipe fails

# Configuration (override with environment variables)
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_CONTAINER="${DB_CONTAINER:-myapp_db}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-myapp_db}"

# S3 Configuration (optional - set these to enable S3 upload)
# S3_BUCKET="${S3_BUCKET:-your-bucket-name}"
# S3_PREFIX="${S3_PREFIX:-backups/}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump database from Docker container
# Write to a temp file first — a partial write (e.g. pg_dump killed mid-stream) can
# produce a structurally valid gzip that passes integrity checks but contains incomplete
# data. Atomic rename ensures BACKUP_FILE is never a partial file.
BACKUP_FILE="$BACKUP_DIR/db_${DATE}.sql.gz"
BACKUP_TMP="${BACKUP_FILE}.tmp"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_TMP"

# Verify the snapshot is non-empty and valid gzip before promoting to final path
if ! gzip -t "$BACKUP_TMP" 2>/dev/null || [ ! -s "$BACKUP_TMP" ]; then
    echo "[$(date)] ERROR: Backup file is empty or corrupt!"
    rm -f "$BACKUP_TMP"
    exit 1
fi
mv "$BACKUP_TMP" "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup successful: $BACKUP_FILE ($BACKUP_SIZE)"

# Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    echo "[$(date)] Uploading to S3..."
    if aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/${S3_PREFIX}$(basename "$BACKUP_FILE")" \
        --storage-class STANDARD_IA; then
        echo "[$(date)] S3 upload successful"
    else
        echo "[$(date)] ERROR: S3 upload failed!"
        exit 1
    fi
fi

# Clean up old backups
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "db_*.sql.gz" | wc -l)
echo "[$(date)] Backup complete. $REMAINING_BACKUPS backup(s) retained."
