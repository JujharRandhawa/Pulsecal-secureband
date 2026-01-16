#!/bin/sh
# PulseCal SecureBand - Database Backup Script
# Runs as cron job in backup container

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pulsecal_backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting database backup..."

# Wait for PostgreSQL to be ready
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Create backup
echo "[$(date)] Creating backup: ${BACKUP_FILE}"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
  
  # Get backup size
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup size: ${BACKUP_SIZE}"
  
  # Cleanup old backups
  echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
  find "$BACKUP_DIR" -name "pulsecal_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
  echo "[$(date)] Cleanup completed"
else
  echo "[$(date)] ERROR: Backup failed!"
  exit 1
fi
