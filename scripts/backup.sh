#!/bin/bash

# PulseCal SecureBand - Backup Script
# Creates backups of database and Redis data

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL database
backup_database() {
    log_info "Backing up PostgreSQL database..."
    
    local backup_file="$BACKUP_DIR/pulsecal_db_${TIMESTAMP}.sql.gz"
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        pg_dump -U "${DB_USERNAME:-postgres}" "${DB_DATABASE:-pulsecal}" | \
        gzip > "$backup_file"
    
    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_info "Database backup created: $backup_file (${size})"
        echo "$backup_file"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Backup Redis data
backup_redis() {
    log_info "Backing up Redis data..."
    
    local backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    # Trigger Redis save
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T redis redis-cli BGSAVE
    
    # Wait for save to complete
    sleep 5
    
    # Copy RDB file
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" cp \
        redis:/data/dump.rdb "$backup_file" || true
    
    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_info "Redis backup created: $backup_file (${size})"
        echo "$backup_file"
    else
        log_warn "Redis backup skipped (no data or AOF enabled)"
    fi
}

# Create backup manifest
create_manifest() {
    local manifest_file="$BACKUP_DIR/backup_${TIMESTAMP}.manifest"
    
    cat > "$manifest_file" <<EOF
Backup Manifest
===============
Timestamp: ${TIMESTAMP}
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
System: PulseCal SecureBand
Version: $(git describe --tags --always 2>/dev/null || echo "unknown")

Backup Files:
$(ls -lh "$BACKUP_DIR"/*${TIMESTAMP}* 2>/dev/null | awk '{print $9, "(" $5 ")"}')

Database:
- Host: ${DB_HOST:-postgres}
- Database: ${DB_DATABASE:-pulsecal}
- User: ${DB_USERNAME:-postgres}

Restore Instructions:
1. Stop services: docker-compose -f docker-compose.prod.yml down
2. Restore database: ./scripts/restore.sh $BACKUP_DIR/pulsecal_db_${TIMESTAMP}.sql.gz
3. Restore Redis: ./scripts/restore.sh $BACKUP_DIR/redis_${TIMESTAMP}.rdb redis
4. Start services: docker-compose -f docker-compose.prod.yml up -d
EOF
    
    log_info "Backup manifest created: $manifest_file"
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    find "$BACKUP_DIR" -name "*.rdb" -type f -mtime +${RETENTION_DAYS} -delete
    find "$BACKUP_DIR" -name "*.manifest" -type f -mtime +${RETENTION_DAYS} -delete
    
    log_info "Old backups cleaned"
}

# Main backup function
main() {
    log_info "Starting backup process..."
    
    backup_database
    backup_redis
    create_manifest
    cleanup_old_backups
    
    log_info "Backup completed successfully!"
    log_info "Backup location: $BACKUP_DIR"
}

main "$@"
