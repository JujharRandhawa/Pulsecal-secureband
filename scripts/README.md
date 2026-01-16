# Deployment Scripts

This directory contains scripts for deploying and maintaining PulseCal SecureBand in production.

## Scripts

### Deployment

- **`deploy.sh`** / **`deploy.ps1`** - Automated deployment script
  - Validates prerequisites
  - Checks environment configuration
  - Builds Docker images
  - Starts services
  - Runs database migrations
  - Verifies deployment

### Backup and Restore

- **`backup.sh`** / **`backup.ps1`** - Creates system backups
  - PostgreSQL database backup (compressed)
  - Redis data backup
  - Backup manifest generation
  - Automatic cleanup of old backups

- **`restore.sh`** / **`restore.ps1`** - Restores from backups
  - Database restore with verification
  - Redis restore support
  - Safety confirmations

### Health Monitoring

- **`health-check.sh`** / **`health-check.ps1`** - System health verification
  - Docker service status
  - Database connectivity
  - Redis connectivity
  - HTTP endpoint checks
  - Disk space monitoring
  - Backup verification

### Automation

- **`setup-cron.sh`** - Sets up automated backups via cron (Linux only)
  - Configurable backup schedule
  - Log file management

## Usage

### Linux/macOS

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy
./scripts/deploy.sh

# Backup
./scripts/backup.sh

# Health check
./scripts/health-check.sh

# Setup automated backups
./scripts/setup-cron.sh
```

### Windows

```powershell
# Deploy
.\scripts\deploy.ps1

# Backup
.\scripts\backup.ps1

# Health check
.\scripts\health-check.ps1
```

## Script Requirements

All scripts require:
- Docker and Docker Compose installed
- `.env` file configured
- Sufficient system resources
- Network connectivity

## Exit Codes

- `0` - Success
- `1` - Error (check output for details)

## Logging

Scripts output to:
- Standard output (console)
- Log files in `logs/` directory (for automated runs)

## Security

- Scripts do not require root/admin privileges
- All sensitive operations require confirmation
- Backup files contain sensitive data - secure appropriately
