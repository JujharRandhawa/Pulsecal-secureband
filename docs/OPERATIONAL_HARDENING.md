# PulseCal SecureBand - Operational Hardening

## Overview

Operational hardening policies and procedures for prison environment deployment. This document covers audit logging, tamper resistance, forensic mode, manual overrides, and disaster recovery.

## Table of Contents

1. [Admin Activity Audit Log](#admin-activity-audit-log)
2. [Tamper-Resistant Logs](#tamper-resistant-logs)
3. [Read-Only Forensic Mode](#read-only-forensic-mode)
4. [Manual Override Procedures](#manual-override-procedures)
5. [Disaster Recovery Plan](#disaster-recovery-plan)

---

## 1. Admin Activity Audit Log

### Purpose

Comprehensive audit logging of all administrative actions to ensure accountability, compliance, and security in prison environments.

### Features

- **Complete Activity Tracking**: All admin actions logged
- **Tamper Resistance**: Cryptographic hash chain prevents log tampering
- **Immutable Records**: Audit logs cannot be deleted or modified
- **Correlation Tracking**: Related actions linked via correlation IDs
- **Severity Levels**: Info, Warning, Critical classifications
- **Approval Tracking**: Critical actions require approval

### Logged Actions

| Category | Actions |
|----------|---------|
| **Authentication** | Login, Logout, Password Change, Session Invalidation |
| **Jail Management** | Create, Update, Deactivate Jail Account |
| **Device Management** | Assign, Unassign, Update Device Status |
| **Inmate Management** | Create, Update, Release, Transfer Inmate |
| **Alert Management** | Acknowledge, Resolve, Escalate Alert |
| **System Configuration** | Enable/Disable Forensic Mode, Manual Overrides |
| **Data Access** | View Sensitive Data, Export Data, Generate Reports |

### Implementation

```typescript
// Automatic audit logging via decorator
@Audit({
  action: 'inmate_updated',
  resourceType: 'inmate',
  severity: 'warning',
})
@Put(':id')
async updateInmate(@Param('id') id: string, @Body() dto: UpdateInmateDto) {
  // Implementation
}

// Critical action requiring approval
@AuditCritical({
  action: 'jail_deactivated',
  resourceType: 'jail',
})
@Post(':id/deactivate')
async deactivateJail(@Param('id') id: string) {
  // Implementation
}
```

### Audit Log Structure

```sql
admin_audit_log:
  - id (UUID)
  - timestamp (TIMESTAMPTZ)
  - jail_id (UUID)
  - user_id (UUID)
  - action (VARCHAR)
  - resource_type (VARCHAR)
  - resource_id (UUID)
  - ip_address (INET)
  - user_agent (TEXT)
  - request_method (VARCHAR)
  - request_path (TEXT)
  - request_body (JSONB)
  - response_status (INTEGER)
  - old_values (JSONB)
  - new_values (JSONB)
  - reason (TEXT)
  - approval_required (BOOLEAN)
  - approved_by (UUID)
  - approved_at (TIMESTAMPTZ)
  - hash_chain (TEXT) -- Tamper resistance
  - previous_hash (TEXT)
  - severity (VARCHAR)
  - correlation_id (UUID)
  - metadata (JSONB)
```

### Querying Audit Logs

```sql
-- View critical actions
SELECT * FROM critical_admin_actions
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- Admin activity summary
SELECT * FROM admin_activity_summary
ORDER BY date DESC;

-- Verify audit log integrity
SELECT * FROM verify_audit_integrity(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

---

## 2. Tamper-Resistant Logs

### Hash Chain Implementation

Each audit log entry includes a cryptographic hash that links to the previous entry, creating an immutable chain.

### How It Works

1. **First Entry**: Hash calculated from entry data
2. **Subsequent Entries**: Hash calculated from previous hash + current entry data
3. **Verification**: Any modification breaks the chain

### Hash Chain Formula

```
hash_chain = SHA256(previous_hash || entry_data)
```

Where `entry_data` includes:
- Entry ID
- Timestamp
- Jail ID
- User ID
- Action
- Resource Type
- Resource ID
- New Values

### Integrity Verification

```sql
-- Verify entire audit log integrity
SELECT * FROM verify_audit_integrity(
  '2024-01-01'::TIMESTAMPTZ,
  NOW()
);

-- Check for tampering
SELECT 
    entry_id,
    timestamp,
    is_valid,
    expected_hash,
    actual_hash
FROM verify_audit_integrity()
WHERE is_valid = false;
```

### Protection Mechanisms

1. **Database-Level**: Hash calculated by database trigger (cannot be bypassed)
2. **Application-Level**: Hash verified on read operations
3. **Scheduled Verification**: Daily integrity checks
4. **Alert on Tampering**: Immediate notification if tampering detected

### Best Practices

- **Regular Verification**: Run integrity checks daily
- **Backup Hash Chains**: Include hash chains in backups
- **Offline Verification**: Verify backups independently
- **Alert Configuration**: Set up alerts for integrity failures

---

## 3. Read-Only Forensic Mode

### Purpose

Enable read-only mode for forensic investigations, incident response, or system maintenance without risk of data modification.

### Features

- **Read-Only Enforcement**: Blocks all write operations
- **Audit Trail**: All forensic mode activations logged
- **Time-Limited**: Requires explicit enable/disable
- **Reason Tracking**: Must provide reason for activation
- **Approval Required**: Critical system change

### Enabling Forensic Mode

```sql
-- Enable read-only forensic mode
SELECT enable_forensic_mode(
    'admin-user-id'::UUID,
    'Investigation of security incident #12345',
    true  -- read-only
);
```

### Disabling Forensic Mode

```sql
-- Disable forensic mode
SELECT disable_forensic_mode(
    'admin-user-id'::UUID,
    'Investigation complete, returning to normal operations'
);
```

### API Usage

```typescript
// Enable forensic mode
await forensicService.enableForensicMode(
  jailId,
  'Security investigation',
  true  // read-only
);

// Check if forensic mode is active
const isActive = await forensicService.isForensicModeActive();

// Enforce read-only (throws exception if writes attempted)
await forensicService.enforceReadOnly();
```

### Protected Operations

When forensic mode is active (read-only), the following operations are blocked:

- **CREATE**: New records cannot be created
- **UPDATE**: Existing records cannot be modified
- **DELETE**: Records cannot be deleted
- **ASSIGNMENTS**: Device assignments cannot be changed
- **ALERTS**: Alert status cannot be modified
- **CONFIGURATION**: System configuration cannot be changed

### Allowed Operations

- **READ**: All read operations allowed
- **QUERIES**: Database queries allowed
- **REPORTS**: Report generation allowed
- **EXPORTS**: Data export allowed

### Forensic Mode History

```sql
-- View forensic mode history
SELECT * FROM forensic_mode_history
ORDER BY enabled_at DESC;
```

---

## 4. Manual Override Procedures

### Purpose

Emergency procedures for critical situations requiring manual intervention when automated systems cannot handle the scenario.

### Override Types

1. **Emergency**: Life-threatening situations
2. **Maintenance**: Planned system maintenance
3. **Recovery**: Disaster recovery operations

### Override Request Process

```sql
-- Create override request
SELECT create_override_request(
    'emergency'::VARCHAR,           -- override_type
    'device'::VARCHAR,              -- resource_type
    'device-uuid'::UUID,            -- resource_id
    'force_unassign'::VARCHAR,      -- action
    'admin-user-id'::UUID,          -- requested_by
    'Medical emergency - device removal required',  -- reason
    'Doctor authorization provided', -- justification
    '{"authorization_doc": "..."}'::JSONB  -- metadata
);
```

### Override Approval

```sql
-- Approve override
UPDATE manual_overrides
SET 
    approved_by = 'approver-user-id'::UUID,
    approved_at = NOW(),
    status = 'approved'
WHERE id = 'override-uuid'::UUID;
```

### Override Execution

```sql
-- Execute override
UPDATE manual_overrides
SET 
    executed_at = NOW(),
    status = 'executed',
    new_state = '{"status": "unassigned"}'::JSONB
WHERE id = 'override-uuid'::UUID;
```

### Override Rollback

```sql
-- Rollback override
UPDATE manual_overrides
SET 
    rollback_executed = true,
    rollback_at = NOW(),
    status = 'rolled_back'
WHERE id = 'override-uuid'::UUID;
```

### Override Policies

1. **Documentation Required**: All overrides must include reason and justification
2. **Approval Required**: Critical overrides require second admin approval
3. **Time-Limited**: Overrides expire after 24 hours if not executed
4. **Audit Trail**: All override actions logged in audit log
5. **Rollback Available**: Most overrides can be rolled back

### Override Monitoring

```sql
-- View pending overrides
SELECT * FROM manual_overrides
WHERE status = 'pending'
ORDER BY requested_at DESC;

-- View executed overrides
SELECT * FROM manual_overrides
WHERE status = 'executed'
  AND executed_at >= NOW() - INTERVAL '7 days'
ORDER BY executed_at DESC;
```

---

## 5. Disaster Recovery Plan

### Overview

Comprehensive disaster recovery procedures for PulseCal SecureBand in prison environments.

### Recovery Objectives

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour (last backup)
- **Data Retention**: 7 years (compliance requirement)

### Disaster Scenarios

| Scenario | Impact | Recovery Procedure |
|----------|--------|-------------------|
| **Database Corruption** | Data loss, system unavailable | Restore from backup, verify integrity |
| **Hardware Failure** | Complete system failure | Restore to new hardware, restore data |
| **Network Outage** | System unreachable | Wait for network restoration, verify connectivity |
| **Security Breach** | Potential data compromise | Enable forensic mode, investigate, restore if needed |
| **Natural Disaster** | Facility damage | Activate offsite backup, restore to alternate location |

### Recovery Procedures

#### 1. Database Corruption

```bash
# 1. Stop all services
docker-compose -f docker-compose.onpremise.yml down

# 2. Backup current state (if possible)
docker-compose -f docker-compose.onpremise.yml exec postgres \
  pg_dump -U pulsecal -d pulsecal_secureband > corruption_backup.sql

# 3. Restore from last known good backup
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband

# 4. Verify data integrity
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "SELECT COUNT(*) FROM inmates;"

# 5. Restart services
docker-compose -f docker-compose.onpremise.yml up -d

# 6. Verify audit log integrity
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT * FROM verify_audit_integrity();"
```

#### 2. Complete System Failure

```bash
# 1. Provision new hardware/VM

# 2. Install prerequisites
# (See DEPLOYMENT_GUIDE.md)

# 3. Restore from offsite backup
# Copy backup files to new system
scp backups/*.sql.gz user@new-server:/backups/

# 4. Deploy system
docker-compose -f docker-compose.onpremise.yml up -d

# 5. Restore database
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_secureband

# 6. Verify system health
docker-compose -f docker-compose.onpremise.yml ps
curl http://localhost/health
```

#### 3. Security Breach

```bash
# 1. Immediately enable forensic mode
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT enable_forensic_mode('system'::UUID, 'Security breach investigation', true);"

# 2. Invalidate all sessions
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c "DELETE FROM sessions;"

# 3. Review audit logs
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT * FROM critical_admin_actions WHERE timestamp >= NOW() - INTERVAL '24 hours';"

# 4. Change all passwords
# (See ADMIN_OPERATIONS.md - Password Management)

# 5. Investigate breach
# Review logs, identify compromised accounts, assess damage

# 6. Restore from backup if data compromised
# (See Database Corruption procedure)

# 7. Disable forensic mode after investigation
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_secureband -c \
  "SELECT disable_forensic_mode('system'::UUID, 'Investigation complete');"
```

### Backup Strategy

#### Automated Backups

- **Frequency**: Daily at 2 AM
- **Retention**: 30 days local, 7 years offsite
- **Format**: Compressed SQL dumps
- **Verification**: Monthly restore testing

#### Offsite Backups

- **Frequency**: Weekly
- **Location**: Secure offsite facility
- **Encryption**: AES-256 encryption
- **Transport**: Secure transfer protocol
- **Verification**: Quarterly restore testing

#### Backup Verification

```bash
# Monthly backup verification
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)

# Create test database
docker-compose -f docker-compose.onpremise.yml exec postgres \
  createdb -U pulsecal pulsecal_test_restore

# Restore to test database
gunzip < "$LATEST_BACKUP" | \
  docker-compose -f docker-compose.onpremise.yml exec -T postgres \
  psql -U pulsecal -d pulsecal_test_restore

# Verify data
docker-compose -f docker-compose.onpremise.yml exec postgres \
  psql -U pulsecal -d pulsecal_test_restore -c \
  "SELECT COUNT(*) FROM inmates; SELECT COUNT(*) FROM devices;"

# Cleanup
docker-compose -f docker-compose.onpremise.yml exec postgres \
  dropdb -U pulsecal pulsecal_test_restore
```

### Recovery Testing

#### Quarterly DR Drill

1. **Preparation**: Schedule maintenance window
2. **Simulation**: Simulate disaster scenario
3. **Recovery**: Execute recovery procedures
4. **Verification**: Verify system functionality
5. **Documentation**: Document lessons learned
6. **Improvement**: Update procedures based on findings

### Contact Information

- **Primary Admin**: [Contact Info]
- **Backup Admin**: [Contact Info]
- **Security Officer**: [Contact Info]
- **Vendor Support**: [Contact Info]

### Recovery Checklist

- [ ] Identify disaster type
- [ ] Assess impact and scope
- [ ] Activate forensic mode (if security-related)
- [ ] Notify stakeholders
- [ ] Locate latest backup
- [ ] Verify backup integrity
- [ ] Execute recovery procedure
- [ ] Verify system functionality
- [ ] Verify data integrity
- [ ] Verify audit log integrity
- [ ] Document incident
- [ ] Post-incident review

---

## System Hooks

### Audit Logging Hooks

All critical operations automatically trigger audit logging:

- **Database Triggers**: Automatic audit log creation
- **Application Interceptors**: Request/response logging
- **Decorator-Based**: Easy integration with controllers

### Forensic Mode Hooks

- **Database Functions**: Atomic enable/disable operations
- **Application Guards**: Automatic write protection
- **Service Checks**: Pre-operation validation

### Manual Override Hooks

- **Request Creation**: Automatic audit logging
- **Approval Workflow**: Status tracking
- **Execution Tracking**: State changes logged
- **Rollback Support**: Reversible operations

---

## Compliance

### Requirements Met

- ✅ **Audit Trail**: Complete activity logging
- ✅ **Tamper Resistance**: Cryptographic hash chains
- ✅ **Forensic Capability**: Read-only investigation mode
- ✅ **Emergency Procedures**: Manual override system
- ✅ **Disaster Recovery**: Comprehensive recovery plan
- ✅ **Data Retention**: 7-year retention policy

### Documentation

- **Policies**: This document
- **Procedures**: Step-by-step guides
- **System Hooks**: Implementation details
- **Recovery Plans**: Disaster scenarios covered

---

For implementation details, see system code in `packages/api/src/audit/` and `packages/api/src/forensic/`
