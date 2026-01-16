#!/bin/bash

# PulseCal SecureBand - Restore Script
# Restores database and Redis from backups

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

# Confirm restore
confirm_restore() {
    log_warn "WARNING: This will overwrite existing data!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Restore PostgreSQL database
restore_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring PostgreSQL database from $backup_file..."
    log_warn "This will drop and recreate the database!"
    
    confirm_restore
    
    # Stop API to prevent connections
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" stop api || true
    
    # Drop and recreate database
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        psql -U "${DB_USERNAME:-postgres}" -c "DROP DATABASE IF EXISTS ${DB_DATABASE:-pulsecal};" || true
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        psql -U "${DB_USERNAME:-postgres}" -c "CREATE DATABASE ${DB_DATABASE:-pulsecal};"
    
    # Restore from backup
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | \
            docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
                psql -U "${DB_USERNAME:-postgres}" "${DB_DATABASE:-pulsecal}"
    else
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
            psql -U "${DB_USERNAME:-postgres}" "${DB_DATABASE:-pulsecal}" < "$backup_file"
    fi
    
    log_info "Database restored successfully"
    
    # Restart API
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" start api
}

# Restore Redis data
restore_redis() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring Redis data from $backup_file..."
    
    confirm_restore
    
    # Stop Redis
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" stop redis
    
    # Copy backup file
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" cp \
        "$backup_file" redis:/data/dump.rdb
    
    # Start Redis
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" start redis
    
    log_info "Redis restored successfully"
}

# Main restore function
main() {
    if [ $# -eq 0 ]; then
        log_error "Usage: $0 <backup_file> [redis]"
        log_info "Examples:"
        log_info "  $0 backups/pulsecal_db_20240115_020000.sql.gz"
        log_info "  $0 backups/redis_20240115_020000.rdb redis"
        exit 1
    fi
    
    local backup_file="$1"
    local restore_type="${2:-database}"
    
    if [ "$restore_type" = "redis" ]; then
        restore_redis "$backup_file"
    else
        restore_database "$backup_file"
    fi
    
    log_info "Restore completed successfully!"
}

main "$@"
