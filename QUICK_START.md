# PulseCal SecureBand - Quick Start Guide

Quick deployment guide for on-premise jail installation.

## Prerequisites

- Docker >= 20.10
- Docker Compose >= 2.0
- 8 GB RAM minimum
- 100 GB disk space

## 5-Minute Setup

### 1. Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env and set required values:
# - DB_PASSWORD (strong password)
# - SESSION_SECRET (generate with: openssl rand -base64 32)
```

### 2. Deploy

**Linux/macOS:**
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

**Windows:**
```powershell
.\scripts\deploy.ps1
```

### 3. Verify

```bash
# Check services
docker-compose -f docker-compose.prod.yml ps

# Access dashboard
open http://localhost:3000
```

## Required Configuration

Before deployment, ensure these are set in `.env`:

```bash
# Database password (REQUIRED)
DB_PASSWORD=your-strong-password-here

# Session secret (REQUIRED)
SESSION_SECRET=$(openssl rand -base64 32)

# Production settings (REQUIRED)
NODE_ENV=production
DEBUG=false
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

## Post-Deployment

### Setup Automated Backups

**Linux:**
```bash
./scripts/setup-cron.sh
```

**Windows:**
- Use Task Scheduler to run `scripts\backup.ps1` daily

### Health Monitoring

```bash
# Run health check
./scripts/health-check.sh  # Linux
.\scripts\health-check.ps1  # Windows
```

## Access Points

- **Dashboard:** http://localhost:3000
- **API:** http://localhost:3001
- **API Health:** http://localhost:3001/health
- **AI Services:** http://localhost:8000
- **AI Health:** http://localhost:8000/api/v1/health

## Common Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Backup
./scripts/backup.sh  # Linux
.\scripts\backup.ps1  # Windows
```

## Troubleshooting

**Services not starting:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check health
./scripts/health-check.sh
```

**Database issues:**
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
```

For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md).
