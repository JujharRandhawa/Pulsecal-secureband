#!/bin/bash

# PulseCal SecureBand - Cron Setup Script
# Sets up automated backups via cron

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
CRON_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"  # Default: Daily at 2 AM

# Create cron job
setup_cron() {
    local cron_job="$CRON_SCHEDULE $BACKUP_SCRIPT >> $PROJECT_ROOT/logs/backup.log 2>&1"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
        echo "Cron job already exists"
        return 0
    fi
    
    # Add cron job
    (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
    
    echo "Cron job added: $CRON_SCHEDULE"
    echo "Backup script: $BACKUP_SCRIPT"
    echo "Log file: $PROJECT_ROOT/logs/backup.log"
}

setup_cron
