# PulseCal SecureBand - On-Premise Jail Deployment Guide

This document provides comprehensive instructions for deploying PulseCal SecureBand in an on-premise jail environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Health Checks](#health-checks)
7. [Backup and Restore](#backup-and-restore)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git** (for cloning repository)
- **OpenSSL** (for generating secrets)

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 100 GB (SSD recommended)
- Network: 1 Gbps

**Recommended:**
- CPU: 8+ cores
- RAM: 16 GB
- Disk: 500 GB SSD
- Network: 10 Gbps

### Operating System

- Linux (Ubuntu 20.04+, CentOS 8+, RHEL 8+)
- Windows Server 2019+ (with WSL2 or Docker Desktop)

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd pulsecal-secureband
```

### 2. Install Dependencies

**Linux:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Windows:**
- Install Docker Desktop from https://www.docker.com/products/docker-desktop
- Docker Compose is included

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your configuration
nano .env  # or use your preferred editor
```

**Required Configuration:**
- `DB_PASSWORD` - Strong database password
- `SESSION_SECRET` - Generate with: `openssl rand -base64 32`
- `CORS_ORIGIN` - Your dashboard URL

## Configuration

### Environment Variables

All configuration is done via environment variables in `.env` file:

#### Database Configuration
```bash
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<strong-password>
DB_DATABASE=pulsecal
DB_SSL=false
DB_SYNCHRONIZE=false  # MUST be false in production
DB_LOGGING=false      # MUST be false in production
```

#### Security Settings
```bash
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
LOGIN_ALLOWED_IPS=  # Optional: comma-separated CIDR blocks
```

#### Service Ports
```bash
WEB_PORT=3000
API_PORT=3001
AI_SERVICES_PORT=8000
POSTGRES_PORT=5432
REDIS_PORT=6379
```

#### Alert Thresholds (Optional)
```bash
# Heart Rate
ALERT_HR_NORMAL_MIN=60
ALERT_HR_NORMAL_MAX=100
ALERT_HR_WARNING_MIN=50
ALERT_HR_WARNING_MAX=120
ALERT_HR_CRITICAL_MIN=40
ALERT_HR_CRITICAL_MAX=150

# Temperature
ALERT_TEMP_NORMAL_MIN=36.1
ALERT_TEMP_NORMAL_MAX=37.2
ALERT_TEMP_WARNING_MIN=35.5
ALERT_TEMP_WARNING_MAX=38.0
ALERT_TEMP_CRITICAL_MIN=34.0
ALERT_TEMP_CRITICAL_MAX=39.5

# Oxygen Saturation
ALERT_SPO2_NORMAL_MIN=95
ALERT_SPO2_WARNING_MIN=93
ALERT_SPO2_CRITICAL_MIN=90

# Confidence
ALERT_MIN_CONFIDENCE=0.6
```

### Production Settings

**Critical Production Settings (MUST be set):**
- `NODE_ENV=production`
- `DEBUG=false`
- `DB_SYNCHRONIZE=false`
- `DB_LOGGING=false`
- `TRACING_ENABLED=false`

## Deployment

### Automated Deployment

**Linux/macOS:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Windows (PowerShell):**
```powershell
.\scripts\deploy.ps1
```

### Manual Deployment

```bash
# 1. Create directories
mkdir -p backups logs database/init

# 2. Build images
docker-compose -f docker-compose.prod.yml build

# 3. Start services
docker-compose -f docker-compose.prod.yml up -d

# 4. Wait for services to be healthy
docker-compose -f docker-compose.prod.yml ps

# 5. Verify deployment
curl http://localhost:3001/health
```

### Verify Deployment

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:8000/api/v1/health
curl http://localhost:3000

# Run health check script
./scripts/health-check.sh  # Linux
.\scripts\health-check.ps1  # Windows
```

## Health Checks

### Automated Health Checks

The system includes comprehensive health checks:

**API Health Endpoints:**
- `/health` - Full health check (database, Redis, AI services, memory, disk)
- `/health/liveness` - Liveness probe (always returns OK)
- `/health/readiness` - Readiness probe (checks dependencies)
- `/health/startup` - Startup probe (checks critical services)

**AI Services Health:**
- `/api/v1/health` - AI services health check

### Manual Health Check

```bash
# Run health check script
./scripts/health-check.sh  # Linux
.\scripts\health-check.ps1  # Windows
```

**Health Check Script Checks:**
- Docker service status
- Database connectivity
- Redis connectivity
- HTTP endpoint accessibility
- Disk space usage
- Recent backups

## Backup and Restore

### Automated Backups

**Setup Automated Backups (Linux):**
```bash
# Setup cron job for daily backups
./scripts/setup-cron.sh
```

**Manual Backup:**
```bash
# Linux
./scripts/backup.sh

# Windows
.\scripts\backup.ps1
```

**Backup Contents:**
- PostgreSQL database dump (compressed)
- Redis data dump (if available)
- Backup manifest with metadata

**Backup Location:**
- Default: `./backups/`
- Configurable via `BACKUP_DIR` environment variable

**Backup Retention:**
- Default: 30 days
- Configurable via `BACKUP_RETENTION_DAYS` environment variable

### Restore from Backup

**Restore Database:**
```bash
# Linux
./scripts/restore.sh backups/pulsecal_db_20240115_020000.sql.gz

# Windows
.\scripts\restore.ps1 backups\pulsecal_db_20240115_020000.sql.gz
```

**Restore Redis:**
```bash
# Linux
./scripts/restore.sh backups/redis_20240115_020000.rdb redis

# Windows
.\scripts\restore.ps1 backups\redis_20240115_020000.rdb redis
```

**⚠️ WARNING:** Restore will overwrite existing data. Always backup before restoring.

## Maintenance

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api
```

### Update System

```bash
# 1. Pull latest code
git pull

# 2. Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. Restart services
docker-compose -f docker-compose.prod.yml up -d
```

### Database Maintenance

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d pulsecal

# Run maintenance queries
# Vacuum analyze
VACUUM ANALYZE;

# Check database size
SELECT pg_size_pretty(pg_database_size('pulsecal'));
```

## Troubleshooting

### Services Not Starting

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs
```

**Common issues:**
- Port conflicts: Check if ports are already in use
- Insufficient resources: Check CPU/RAM usage
- Configuration errors: Validate `.env` file

### Database Connection Issues

**Check database status:**
```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

**Verify credentials:**
- Check `DB_PASSWORD` in `.env` file
- Ensure password doesn't contain special characters that need escaping

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**Database performance:**
```bash
# Check active connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d pulsecal -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Disk Space Issues

**Check disk usage:**
```bash
df -h  # Linux
Get-PSDrive C  # Windows
```

**Clean up:**
```bash
# Remove old backups
find backups -name "*.sql.gz" -mtime +30 -delete

# Clean Docker
docker system prune -a
```

## Security Considerations

### Network Security

- **Firewall Rules:**
  - Only expose necessary ports (3000, 3001, 8000)
  - Restrict database port (5432) to internal network only
  - Use reverse proxy (nginx/traefik) for HTTPS

### Access Control

- **IP Restrictions:**
  - Configure `LOGIN_ALLOWED_IPS` in `.env`
  - Use VPN for remote access

### Data Security

- **Encryption:**
  - Use SSL/TLS for database connections (`DB_SSL=true`)
  - Encrypt sensitive data at rest
  - Use strong passwords

- **Backup Security:**
  - Encrypt backup files
  - Store backups in secure location
  - Limit backup file access

## Monitoring

### Health Monitoring

Set up monitoring to check:
- Service health endpoints
- Disk space usage
- Database connection pool
- Memory usage
- Backup completion

### Alerting

Configure alerts for:
- Service downtime
- High disk usage (>90%)
- Database connection failures
- Backup failures
- High memory usage

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs`
2. Run health check: `./scripts/health-check.sh`
3. Review this documentation
4. Contact system administrator

---

**Last Updated:** 2026-01-15
**Version:** 1.0.0
