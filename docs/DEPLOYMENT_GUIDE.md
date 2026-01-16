# PulseCal SecureBand - On-Premise Deployment Guide

## Overview

This guide covers the complete on-premise deployment of PulseCal SecureBand in a jail/prison environment. The deployment uses Docker Compose with internal networking only, ensuring no public internet exposure.

## Prerequisites

### Hardware Requirements

- **CPU**: 4+ cores (8+ recommended)
- **RAM**: 16GB minimum (32GB recommended)
- **Storage**: 500GB+ SSD (1TB+ recommended for data retention)
- **Network**: Gigabit Ethernet connection
- **OS**: Linux (Ubuntu 22.04 LTS or RHEL 8+ recommended)

### Software Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git (for deployment)
- Firewall (iptables/ufw)

### Network Requirements

- LAN access only (no public internet)
- Private IP range (10.x.x.x, 172.16-31.x.x, or 192.168.x.x)
- DNS resolution for internal services (optional)

## Installation Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
# Clone or copy PulseCal SecureBand repository
cd /opt
sudo mkdir -p pulsecal-secureband
sudo chown $USER:$USER pulsecal-secureband
cd pulsecal-secureband

# Copy all project files here
# (or use git clone if repository is available)
```

### 3. Configure Environment

```bash
# Copy example environment file
cp deployment/.env.example deployment/.env

# Edit environment variables
nano deployment/.env
```

**Critical Configuration:**
- Change all `CHANGE_ME_*` passwords to strong, unique passwords
- Set `AUTH_ALLOWED_IP_RANGES` to your LAN subnet
- Configure `BACKUP_SCHEDULE` and `BACKUP_RETENTION_DAYS`
- Set `AIR_GAP_MODE=true` for complete isolation (optional)

### 4. Configure Firewall

```bash
# Allow only LAN access
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS from LAN only
sudo ufw allow from 10.0.0.0/8 to any port 80
sudo ufw allow from 172.16.0.0/12 to any port 80
sudo ufw allow from 192.168.0.0/16 to any port 80
sudo ufw allow from 10.0.0.0/8 to any port 443
sudo ufw allow from 172.16.0.0/12 to any port 443
sudo ufw allow from 192.168.0.0/16 to any port 443

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 5. Build and Start Services

```bash
# Navigate to project root
cd /opt/pulsecal-secureband

# Build images
docker-compose -f docker-compose.onpremise.yml build

# Start services
docker-compose -f docker-compose.onpremise.yml up -d

# Check status
docker-compose -f docker-compose.onpremise.yml ps

# View logs
docker-compose -f docker-compose.onpremise.yml logs -f
```

### 6. Initialize Database

```bash
# Wait for PostgreSQL to be ready (usually 30-60 seconds)
docker-compose -f docker-compose.onpremise.yml exec postgres pg_isready -U pulsecal

# Verify database initialization
docker-compose -f docker-compose.onpremise.yml exec postgres psql -U pulsecal -d pulsecal_secureband -c "\dt"
```

### 7. Create Initial Jail Account

```bash
# Access API container
docker-compose -f docker-compose.onpremise.yml exec api sh

# Inside container, create jail account
# (Use the create-jail script or manual SQL)
```

### 8. Verify Deployment

```bash
# Check all services are healthy
docker-compose -f docker-compose.onpremise.yml ps

# Test web access (from LAN)
curl http://<server-ip>/

# Test API health
curl http://<server-ip>/health

# Check logs for errors
docker-compose -f docker-compose.onpremise.yml logs --tail=100
```

## Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LAN Network                          │
│                  (10.0.0.0/8, etc.)                    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTP/HTTPS (Port 80/443)
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Nginx (Reverse Proxy)                  │
│              Container: pulsecal-nginx                  │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   Web        │ │   API       │ │  AI Services│
│  (Next.js)   │ │  (NestJS)   │ │  (FastAPI)  │
└──────────────┘ └──────┬──────┘ └──────┬──────┘
                        │               │
        ┌───────────────┼───────────────┼───────────────┐
        │               │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  PostgreSQL  │ │   Redis     │ │  RabbitMQ   │ │   Backup    │
│ +TimescaleDB │ │   (Cache)   │ │ (Event Bus) │ │  (Scheduled)│
└──────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                        │
        ┌───────────────┴───────────────┐
        │    Internal Network Only      │
        │  (No Public Internet Access)  │
        └───────────────────────────────┘
```

## Service Ports

| Service | Internal Port | External Port | Access |
|---------|--------------|---------------|--------|
| Nginx | 80, 443 | 80, 443 | LAN only |
| Web | 3000 | - | Internal |
| API | 3001 | - | Internal |
| AI Services | 8000 | - | Internal |
| PostgreSQL | 5432 | - | Internal |
| Redis | 6379 | - | Internal |
| RabbitMQ | 5672, 15672 | - | Internal |

## Security Configuration

### Firewall Rules

```bash
# Block all incoming by default
sudo ufw default deny incoming

# Allow only LAN subnets
sudo ufw allow from 10.0.0.0/8 to any port 80
sudo ufw allow from 10.0.0.0/8 to any port 443
sudo ufw allow from 172.16.0.0/12 to any port 80
sudo ufw allow from 172.16.0.0/12 to any port 443
sudo ufw allow from 192.168.0.0/16 to any port 80
sudo ufw allow from 192.168.0.0/16 to any port 443
```

### Air-Gap Mode

For complete isolation, set in `docker-compose.onpremise.yml`:

```yaml
networks:
  pulsecal-internal:
    driver: bridge
    internal: true  # Blocks all external network access
```

### Network Isolation

All services communicate via internal Docker networks:
- `pulsecal-internal`: Service-to-service communication
- `pulsecal-lan`: Nginx to LAN access only

## Backup Strategy

### Automated Backups

Backups run automatically via the `backup` container:
- **Schedule**: Configurable via `BACKUP_SCHEDULE` (default: 2 AM daily)
- **Retention**: Configurable via `BACKUP_RETENTION_DAYS` (default: 30 days)
- **Location**: `./backups/` directory
- **Format**: Compressed SQL dumps (`.sql.gz`)

### Manual Backup

```bash
# Create manual backup
docker-compose -f docker-compose.onpremise.yml exec backup /backup.sh

# List backups
ls -lh backups/

# Restore from backup
gunzip < backups/pulsecal_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband
```

### Backup Storage

- **Local**: Stored in `./backups/` directory
- **External**: Copy backups to external storage/NAS
- **Offsite**: Transfer backups to secure offsite location

## Monitoring

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose -f docker-compose.onpremise.yml ps

# View health check logs
docker inspect pulsecal-api | jq '.[0].State.Health'
```

### Logs

```bash
# View all logs
docker-compose -f docker-compose.onpremise.yml logs

# View specific service logs
docker-compose -f docker-compose.onpremise.yml logs -f api

# View last 100 lines
docker-compose -f docker-compose.onpremise.yml logs --tail=100
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.onpremise.yml logs

# Check service status
docker-compose -f docker-compose.onpremise.yml ps

# Restart service
docker-compose -f docker-compose.onpremise.yml restart <service-name>
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.onpremise.yml exec postgres pg_isready

# Check database exists
docker-compose -f docker-compose.onpremise.yml exec postgres psql -U pulsecal -l

# Verify credentials
docker-compose -f docker-compose.onpremise.yml exec postgres psql -U pulsecal -d pulsecal_secureband
```

### Network Issues

```bash
# Check network connectivity
docker-compose -f docker-compose.onpremise.yml exec api ping postgres
docker-compose -f docker-compose.onpremise.yml exec api ping redis

# Check DNS resolution
docker-compose -f docker-compose.onpremise.yml exec api nslookup postgres
```

## Maintenance

### Updates

```bash
# Pull latest images (if using external registry)
docker-compose -f docker-compose.onpremise.yml pull

# Rebuild and restart
docker-compose -f docker-compose.onpremise.yml up -d --build
```

### Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAUTION: This deletes data)
docker volume prune
```

## Production Checklist

- [ ] All passwords changed from defaults
- [ ] Firewall configured (LAN only)
- [ ] Backups configured and tested
- [ ] Initial jail account created
- [ ] Health checks passing
- [ ] Logs monitored
- [ ] Network isolation verified
- [ ] SSL certificates configured (if using HTTPS)
- [ ] Backup restoration tested
- [ ] Disaster recovery plan documented

## Support

For issues or questions:
1. Check logs: `docker-compose -f docker-compose.onpremise.yml logs`
2. Verify configuration: `deployment/.env`
3. Check network: `docker network ls`
4. Review documentation: `docs/` directory

---

For operational procedures, see `docs/ADMIN_OPERATIONS.md`
