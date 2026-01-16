# PulseCal SecureBand - Disaster Recovery Plan

## Executive Summary

This document outlines the comprehensive disaster recovery plan for PulseCal SecureBand in prison environments. The plan ensures rapid recovery from various disaster scenarios while maintaining data integrity and system security.

## Recovery Objectives

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour (last backup)
- **Data Retention**: 7 years (compliance requirement)
- **System Availability Target**: 99.9% uptime

## Disaster Scenarios

### 1. Database Corruption

**Impact**: Data loss, system unavailable  
**Probability**: Low  
**Severity**: High  

**Recovery Procedure**:
1. Stop all services immediately
2. Backup current corrupted state (for analysis)
3. Restore from last known good backup
4. Verify data integrity
5. Restart services
6. Verify audit log integrity
7. Document incident

**Recovery Time**: 2-4 hours

### 2. Complete Hardware Failure

**Impact**: Complete system failure  
**Probability**: Low  
**Severity**: Critical  

**Recovery Procedure**:
1. Provision new hardware/VM
2. Install prerequisites
3. Deploy system from repository
4. Restore from offsite backup
5. Verify system functionality
6. Update network configuration
7. Test all services

**Recovery Time**: 4-8 hours

### 3. Network Outage

**Impact**: System unreachable  
**Probability**: Medium  
**Severity**: Medium  

**Recovery Procedure**:
1. Wait for network restoration
2. Verify network connectivity
3. Check service health
4. Verify database connectivity
5. Restart services if needed
6. Verify all endpoints

**Recovery Time**: 1-2 hours (after network restored)

### 4. Security Breach

**Impact**: Potential data compromise  
**Probability**: Low  
**Severity**: Critical  

**Recovery Procedure**:
1. Enable forensic mode (read-only)
2. Invalidate all sessions
3. Review audit logs
4. Identify compromised accounts
5. Change all passwords
6. Assess data integrity
7. Restore from backup if needed
8. Disable forensic mode after investigation

**Recovery Time**: 4-24 hours (depending on investigation)

### 5. Natural Disaster

**Impact**: Facility damage, system destruction  
**Probability**: Very Low  
**Severity**: Critical  

**Recovery Procedure**:
1. Activate offsite backup
2. Provision alternate location
3. Restore to alternate location
4. Verify system functionality
5. Update network configuration
6. Test all services
7. Document recovery

**Recovery Time**: 8-24 hours

## Recovery Procedures

### Database Restoration

```bash
# 1. Stop services
docker-compose -f docker-compose.onpremise.yml down

# 2. Backup current state (if possible)
docker-compose -f docker-compose.onpremise.yml up -d postgres
docker-compose -f docker-compose.onpremise.yml exec postgres \
  pg_dump -U pulsecal -d pulsecal_secureband > corruption_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Drop and recreate database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -c "DROP DATABASE IF EXISTS pulsecal_secureband;"
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -c "CREATE DATABASE pulsecal_secureband;"

# 4. Restore from backup
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband

# 5. Verify restoration
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT 
      (SELECT COUNT(*) FROM inmates) as inmates,
      (SELECT COUNT(*) FROM devices) as devices,
      (SELECT COUNT(*) FROM vital_metrics) as vital_metrics,
      (SELECT COUNT(*) FROM alerts) as alerts;
  "

# 6. Verify audit log integrity
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT * FROM verify_audit_integrity() WHERE is_valid = false;"

# 7. Restart services
docker-compose -f docker-compose.onpremise.yml up -d
```

### Complete System Restoration

```bash
# 1. Provision new server
# (Follow DEPLOYMENT_GUIDE.md)

# 2. Copy backup files
scp -r backups/ user@new-server:/opt/pulsecal-secureband/backups/

# 3. Deploy system
cd /opt/pulsecal-secureband
docker-compose -f docker-compose.onpremise.yml up -d postgres

# 4. Wait for PostgreSQL
sleep 30

# 5. Restore database
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband

# 6. Start all services
docker-compose -f docker-compose.onpremise.yml up -d

# 7. Verify system
docker-compose -f docker-compose.onpremise.yml ps
curl http://localhost/health
```

### Security Breach Response

```bash
# 1. Enable forensic mode
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT enable_forensic_mode('system'::UUID, 'Security breach investigation', true);"

# 2. Invalidate all sessions
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "DELETE FROM sessions;"

# 3. Review recent audit logs
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT * FROM critical_admin_actions
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC;
  "

# 4. Review failed login attempts
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "
    SELECT * FROM recent_failed_logins
    ORDER BY failure_count DESC;
  "

# 5. Change all passwords
# (See ADMIN_OPERATIONS.md)

# 6. Assess data integrity
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT * FROM verify_audit_integrity();"

# 7. Restore from backup if data compromised
# (See Database Restoration)

# 8. Disable forensic mode after investigation
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT disable_forensic_mode('system'::UUID, 'Investigation complete');"
```

## Backup Strategy

### Automated Backups

- **Frequency**: Daily at 2 AM
- **Retention**: 30 days local
- **Format**: Compressed SQL dumps
- **Location**: `./backups/` directory

### Offsite Backups

- **Frequency**: Weekly
- **Retention**: 7 years
- **Encryption**: AES-256
- **Location**: Secure offsite facility
- **Transport**: Secure transfer protocol

### Backup Verification

```bash
# Monthly verification
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)

# Create test database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  createdb -U pulsecal pulsecal_test_restore

# Restore to test
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_test_restore

# Verify
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_test_restore -c "
    SELECT 
      (SELECT COUNT(*) FROM inmates) as inmates,
      (SELECT COUNT(*) FROM devices) as devices,
      (SELECT COUNT(*) FROM admin_audit_log) as audit_logs;
  "

# Cleanup
docker-compose -f docker-compose.onpremise.yml exec postgres \
  dropdb -U pulsecal pulsecal_test_restore
```

## Recovery Testing

### Quarterly DR Drill

1. **Schedule**: First Sunday of quarter, 2 AM - 6 AM
2. **Scenario**: Random disaster scenario selected
3. **Execution**: Follow recovery procedures
4. **Verification**: Verify system functionality
5. **Documentation**: Document results and improvements
6. **Review**: Post-drill review meeting

### Testing Checklist

- [ ] Backup restoration tested
- [ ] System functionality verified
- [ ] Data integrity confirmed
- [ ] Audit log integrity verified
- [ ] Network connectivity tested
- [ ] All services operational
- [ ] Documentation updated

## Contact Information

### Primary Contacts

- **System Administrator**: [Name, Phone, Email]
- **Backup Administrator**: [Name, Phone, Email]
- **Security Officer**: [Name, Phone, Email]
- **Database Administrator**: [Name, Phone, Email]

### Escalation Path

1. **Level 1**: System Administrator
2. **Level 2**: Security Officer
3. **Level 3**: Management
4. **Level 4**: Vendor Support

## Recovery Checklist

### Pre-Recovery

- [ ] Identify disaster type
- [ ] Assess impact and scope
- [ ] Notify stakeholders
- [ ] Activate forensic mode (if security-related)
- [ ] Locate latest backup
- [ ] Verify backup integrity

### During Recovery

- [ ] Execute recovery procedure
- [ ] Monitor progress
- [ ] Document steps taken
- [ ] Verify each step completion

### Post-Recovery

- [ ] Verify system functionality
- [ ] Verify data integrity
- [ ] Verify audit log integrity
- [ ] Test all critical operations
- [ ] Document incident
- [ ] Post-incident review
- [ ] Update procedures if needed

## Maintenance Windows

- **Weekly**: Sunday 2 AM - 3 AM
- **Monthly**: First Sunday 2 AM - 4 AM
- **Quarterly**: First Sunday 2 AM - 6 AM (DR Drill)

## Documentation

- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE.md`
- **Admin Operations**: `docs/ADMIN_OPERATIONS.md`
- **Operational Hardening**: `docs/OPERATIONAL_HARDENING.md`
- **This Document**: `docs/DISASTER_RECOVERY_PLAN.md`

---

**Last Updated**: [Date]  
**Next Review**: [Date + 3 months]  
**Version**: 1.0
