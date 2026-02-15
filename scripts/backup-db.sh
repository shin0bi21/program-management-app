#!/bin/bash
# Database Backup Script
# Backs up PostgreSQL database from Docker container, compresses, and optionally uploads to S3

set -e  # Exit on error

# Configuration (override with environment variables)
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_CONTAINER="${DB_CONTAINER:-myapp_db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-myappdb}"

# S3 Configuration (optional - set these to enable S3 upload)
# S3_BUCKET="${S3_BUCKET:-your-bucket-name}"
# S3_PREFIX="${S3_PREFIX:-backups/}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump database from Docker container
BACKUP_FILE="$BACKUP_DIR/db_${DATE}.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup successful: $BACKUP_FILE ($BACKUP_SIZE)"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    echo "[$(date)] Uploading to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$S3_PREFIX" --storage-class STANDARD_IA
    if [ $? -eq 0 ]; then
        echo "[$(date)] S3 upload successful"
    else
        echo "[$(date)] WARNING: S3 upload failed!"
    fi
fi

# Clean up old backups
echo "[$(date)] Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "db_*.sql.gz" | wc -l)
echo "[$(date)] Backup complete. $REMAINING_BACKUPS backup(s) retained."
