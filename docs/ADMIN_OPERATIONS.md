# PulseCal SecureBand - Admin Operations Manual

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Maintenance](#weekly-maintenance)
3. [Monthly Tasks](#monthly-tasks)
4. [Backup and Recovery](#backup-and-recovery)
5. [Security Procedures](#security-procedures)
6. [Troubleshooting](#troubleshooting)
7. [Emergency Procedures](#emergency-procedures)

## Daily Operations

### Morning Checklist

```bash
# 1. Verify all services are running
docker-compose -f docker-compose.onpremise.yml ps

# Expected output: All services show "Up" status

# 2. Check service health
docker-compose -f docker-compose.onpremise.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# 3. Review error logs
docker-compose -f docker-compose.onpremise.yml logs --tail=50 | grep -i error

# 4. Check disk space
df -h
docker system df

# 5. Verify backup from previous night
ls -lh backups/ | tail -5
```

### Service Status Check

```bash
# Quick status check script
#!/bin/bash
echo "=== PulseCal SecureBand Status ==="
docker-compose -f docker-compose.onpremise.yml ps
echo ""
echo "=== Disk Usage ==="
df -h | grep -E '^/dev|Filesystem'
echo ""
echo "=== Recent Backups ==="
ls -lht backups/ | head -5
```

### Monitoring Endpoints

```bash
# Health check
curl http://localhost/health

# API status
curl http://localhost/api/health

# Web application
curl -I http://localhost/
```

## Weekly Maintenance

### Database Maintenance

```bash
# 1. Vacuum database (every Sunday)
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "VACUUM ANALYZE;"

# 2. Check database size
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT 
      pg_size_pretty(pg_database_size('pulsecal_secureband')) AS database_size;
  "

# 3. Check table sizes
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
  "
```

### Log Rotation

```bash
# Check log sizes
docker-compose -f docker-compose.onpremise.yml exec api du -sh /var/log/*

# Rotate logs (if needed)
docker-compose -f docker-compose.onpremise.yml exec api logrotate -f /etc/logrotate.conf
```

### Security Audit

```bash
# 1. Check for failed login attempts
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT 
      jail_name,
      ip_address,
      COUNT(*) as attempts,
      MAX(attempted_at) as last_attempt
    FROM login_attempts
    WHERE success = false
      AND attempted_at > NOW() - INTERVAL '7 days'
    GROUP BY jail_name, ip_address
    ORDER BY attempts DESC;
  "

# 2. Review active sessions
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT * FROM active_sessions;
  "

# 3. Check for suspicious activity
docker-compose -f docker-compose.onpremise.yml logs | grep -i "unauthorized\|forbidden\|error"
```

## Monthly Tasks

### Database Optimization

```bash
# 1. Reindex database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "REINDEX DATABASE pulsecal_secureband;"

# 2. Update statistics
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "ANALYZE;"

# 3. Check for bloat
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  "
```

### Backup Verification

```bash
# 1. List all backups
ls -lh backups/

# 2. Verify latest backup integrity
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
echo "Verifying: $LATEST_BACKUP"
gunzip -t "$LATEST_BACKUP" && echo "Backup is valid" || echo "Backup is corrupted!"

# 3. Test restore to temporary database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  createdb -U pulsecal pulsecal_test_restore

gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_test_restore

# Cleanup test database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  dropdb -U pulsecal pulsecal_test_restore
```

### System Updates

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Update Docker images (if using external registry)
docker-compose -f docker-compose.onpremise.yml pull

# 3. Rebuild and restart services
docker-compose -f docker-compose.onpremise.yml up -d --build

# 4. Verify services after update
docker-compose -f docker-compose.onpremise.yml ps
```

## Backup and Recovery

### Automated Backups

Backups are scheduled via cron in the `backup` container:
- **Default Schedule**: Daily at 2 AM
- **Retention**: 30 days (configurable)
- **Location**: `./backups/` directory
- **Format**: Compressed SQL dumps

### Manual Backup

```bash
# Create immediate backup
docker-compose -f docker-compose.onpremise.yml exec backup /backup.sh

# Create backup with custom name
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.onpremise.yml exec postgres \
  pg_dump -U pulsecal -d pulsecal_secureband | \
  gzip > "backups/manual_backup_${TIMESTAMP}.sql.gz"
```

### Backup Restoration

#### Full Database Restore

```bash
# 1. Stop services (optional, recommended)
docker-compose -f docker-compose.onpremise.yml stop api ai-services web

# 2. Drop existing database (CAUTION: This deletes all data!)
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -c "DROP DATABASE IF EXISTS pulsecal_secureband;"

# 3. Recreate database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -c "CREATE DATABASE pulsecal_secureband;"

# 4. Restore from backup
BACKUP_FILE="backups/pulsecal_backup_YYYYMMDD_HHMMSS.sql.gz"
gunzip < "$BACKUP_FILE" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband

# 5. Restart services
docker-compose -f docker-compose.onpremise.yml start api ai-services web
```

#### Partial Restore (Single Table)

```bash
# Restore specific table
BACKUP_FILE="backups/pulsecal_backup_YYYYMMDD_HHMMSS.sql.gz"
gunzip < "$BACKUP_FILE" | \
  grep -A 10000 "CREATE TABLE alerts" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband
```

### Backup Storage Locations

1. **Local**: `./backups/` directory
2. **External**: Copy to NAS/network storage
3. **Offsite**: Transfer to secure offsite location
4. **Cloud** (if allowed): Encrypted cloud storage

### Backup Retention Policy

- **Daily backups**: Last 7 days
- **Weekly backups**: Last 4 weeks
- **Monthly backups**: Last 12 months
- **Yearly backups**: Indefinite

## Security Procedures

### Password Management

```bash
# Change database password
# 1. Update .env file
nano deployment/.env
# Change DB_PASSWORD

# 2. Update in database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -c "ALTER USER pulsecal WITH PASSWORD 'NEW_PASSWORD';"

# 3. Restart services
docker-compose -f docker-compose.onpremise.yml restart api ai-services backup
```

### Jail Account Management

```bash
# Create new jail account
docker-compose -f docker-compose.onpremise.yml exec api \
  ts-node src/auth/scripts/create-jail.ts "Jail Name" "SecurePassword"

# List all jails
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "SELECT name, is_active, created_at FROM jails;"

# Deactivate jail account
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "UPDATE jails SET is_active = false WHERE name = 'Jail Name';"
```

### Firewall Management

```bash
# View firewall rules
sudo ufw status verbose

# Add allowed IP range
sudo ufw allow from 10.0.1.0/24 to any port 80
sudo ufw allow from 10.0.1.0/24 to any port 443

# Remove rule
sudo ufw delete allow from 10.0.1.0/24 to any port 80

# Reload firewall
sudo ufw reload
```

### Access Log Review

```bash
# Review nginx access logs
docker-compose -f docker-compose.onpremise.yml exec nginx \
  tail -100 /var/log/nginx/access.log

# Review failed login attempts
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT * FROM recent_failed_logins;
  "
```

## Troubleshooting

### Service Won't Start

```bash
# 1. Check logs
docker-compose -f docker-compose.onpremise.yml logs <service-name>

# 2. Check dependencies
docker-compose -f docker-compose.onpremise.yml ps

# 3. Restart service
docker-compose -f docker-compose.onpremise.yml restart <service-name>

# 4. Rebuild service
docker-compose -f docker-compose.onpremise.yml up -d --build <service-name>
```

### Database Connection Issues

```bash
# 1. Check PostgreSQL is running
docker-compose -f docker-compose.onpremise.yml exec postgres pg_isready

# 2. Test connection
docker-compose -f docker-compose.onpremise.yml exec api \
  psql -h postgres -U pulsecal -d pulsecal_secureband

# 3. Check credentials
cat deployment/.env | grep DB_

# 4. Verify network connectivity
docker-compose -f docker-compose.onpremise.yml exec api ping postgres
```

### High Memory Usage

```bash
# Check memory usage
docker stats --no-stream

# Check specific service
docker stats pulsecal-api --no-stream

# Restart service to free memory
docker-compose -f docker-compose.onpremise.yml restart <service-name>
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes

# Clean old backups
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

## Emergency Procedures

### Complete System Failure

```bash
# 1. Stop all services
docker-compose -f docker-compose.onpremise.yml down

# 2. Verify data volumes are intact
docker volume ls
docker volume inspect pulsecal-secureband_postgres_data

# 3. Restore from latest backup
# (See Backup Restoration section)

# 4. Restart services
docker-compose -f docker-compose.onpremise.yml up -d

# 5. Verify services
docker-compose -f docker-compose.onpremise.yml ps
```

### Database Corruption

```bash
# 1. Stop services
docker-compose -f docker-compose.onpremise.yml stop api ai-services web

# 2. Attempt database repair
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "VACUUM FULL;"

# 3. If repair fails, restore from backup
# (See Backup Restoration section)
```

### Security Breach

```bash
# 1. Immediately disable all jail accounts
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "UPDATE jails SET is_active = false;"

# 2. Invalidate all sessions
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "DELETE FROM sessions;"

# 3. Block suspicious IPs in firewall
sudo ufw deny from <suspicious-ip>

# 4. Review audit logs
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT * FROM audit_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC;
  "

# 5. Change all passwords
# (See Password Management section)
```

### Network Isolation (Air-Gap Mode)

```bash
# Enable complete network isolation
# Edit docker-compose.onpremise.yml:
# Set networks.pulsecal-internal.internal: true

# Restart services
docker-compose -f docker-compose.onpremise.yml down
docker-compose -f docker-compose.onpremise.yml up -d
```

## Maintenance Windows

### Scheduled Maintenance

1. **Weekly**: Sunday 2 AM - 3 AM
   - Database vacuum
   - Log rotation
   - Security audit

2. **Monthly**: First Sunday 2 AM - 4 AM
   - Database optimization
   - Backup verification
   - System updates

3. **Quarterly**: First Sunday 2 AM - 6 AM
   - Full system review
   - Disaster recovery test
   - Security audit

### Maintenance Notification

Before maintenance:
1. Notify users 24 hours in advance
2. Create backup before maintenance
3. Document all changes
4. Verify services after maintenance

## Contact and Escalation

### Support Contacts

- **System Administrator**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **Security Officer**: [Contact Info]
- **Emergency Contact**: [Contact Info]

### Escalation Procedures

1. **Level 1**: Check logs and documentation
2. **Level 2**: Contact system administrator
3. **Level 3**: Contact security officer
4. **Level 4**: Emergency procedures activation

---

For deployment instructions, see `docs/DEPLOYMENT_GUIDE.md`
