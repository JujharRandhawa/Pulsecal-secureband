# SecureBand Device State Machine

## State Diagram

```
                    ┌─────────────┐
                    │   NEW/UNREG │
                    └──────┬──────┘
                           │
                    Manual Add (Admin)
                           │
                           ▼
                    ┌─────────────┐
                    │   LOCKED    │
                    │             │
                    │ - Registered│
                    │ - Not Active│
                    │ - No Token  │
                    └──────┬──────┘
                           │
                    Auto-activation
                    (on successful add)
                           │
                           ▼
                    ┌─────────────┐
                    │   ACTIVE    │◄────┐
                    │             │     │
                    │ - Can Connect│     │
                    │ - Streaming │     │
                    │ - Token Valid│    │
                    └──────┬──────┘     │
                           │            │
                    Manual Remove        │
                    (with reason)        │
                           │            │
                           ▼            │
                    ┌─────────────┐     │
                    │   REVOKED   │     │
                    │             │     │
                    │ - Cannot    │     │
                    │   Connect   │     │
                    │ - Token     │     │
                    │   Invalid   │     │
                    └─────────────┘     │
                                        │
                    ┌───────────────────┘
                    │
                    │ (Cannot transition back)
                    │
                    └───────────────────┐
                                        │
                                Permanent State
```

## State Transitions

### 1. LOCKED → ACTIVE

**Trigger**: Successful device add operation

**Conditions**:
- Device UID is unique
- Jail ID is valid
- Admin has permission
- Forensic mode is not active

**Actions**:
- Generate auth token
- Set token expiration (1 year)
- Generate nonce seed
- Set bound_at timestamp
- Set status to ACTIVE
- Log audit event

**Result**: Device can now connect and stream data

### 2. ACTIVE → REVOKED

**Trigger**: Manual device removal

**Conditions**:
- Device exists and is ACTIVE
- Removal reason provided
- Admin has permission
- Forensic mode is not active

**Actions**:
- Set status to REVOKED
- Invalidate auth token
- Set removed_at timestamp
- Store removal reason
- Log audit event

**Result**: Device cannot reconnect

### 3. REVOKED → (No Transition)

**Permanent State**: Once revoked, device cannot be reactivated

**Rationale**: Security requirement - revoked devices must remain revoked

## State Properties

### LOCKED

- **Can Connect**: ❌ No
- **Can Stream Data**: ❌ No
- **Token Valid**: ❌ No token issued
- **Can Be Removed**: ✅ Yes (before activation)
- **Can Be Reactivated**: ✅ Yes (if not yet activated)

### ACTIVE

- **Can Connect**: ✅ Yes
- **Can Stream Data**: ✅ Yes
- **Token Valid**: ✅ Yes
- **Can Be Removed**: ✅ Yes
- **Can Be Reactivated**: N/A (already active)

### REVOKED

- **Can Connect**: ❌ No
- **Can Stream Data**: ❌ No
- **Token Valid**: ❌ No (invalidated)
- **Can Be Removed**: N/A (already removed)
- **Can Be Reactivated**: ❌ No (permanent)

## Validation Rules

### Device Registration

```typescript
// Validation checks
1. Device UID format: Alphanumeric, hyphens, underscores
2. Device UID uniqueness: Not already active/locked
3. Jail ID: Must exist and be active
4. Forensic mode: Must not be active
5. Admin permission: Must be authenticated jail admin
```

### Device Removal

```typescript
// Validation checks
1. Device exists: Must be found in database
2. Device status: Must be ACTIVE or LOCKED
3. Removal reason: Must be provided (min 10 chars)
4. Jail match: Device must belong to admin's jail
5. Forensic mode: Must not be active
```

### Device Connection

```typescript
// Validation checks
1. Device exists: Must be in database
2. Device status: Must be ACTIVE
3. Token valid: Token hash must match
4. Token not expired: token_expires_at > NOW()
5. Nonce valid: Nonce validation passes
6. Jail match: Device jail matches request jail
```

## State Machine Implementation

```typescript
enum SecureBandStatus {
  LOCKED = 'LOCKED',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

// Transition: LOCKED → ACTIVE
async addSecureBand() {
  // Validate: Device UID unique
  // Validate: Not already active
  // Generate: Auth token
  // Set: Status = ACTIVE
  // Set: bound_at = NOW()
  // Log: Audit event
}

// Transition: ACTIVE → REVOKED
async removeSecureBand() {
  // Validate: Device exists and is ACTIVE
  // Validate: Removal reason provided
  // Set: Status = REVOKED
  // Set: removed_at = NOW()
  // Invalidate: Auth token
  // Log: Audit event
}
```

## Error Handling

### Duplicate Registration

```typescript
// Error: Device already registered
if (existing.status === ACTIVE || existing.status === LOCKED) {
  throw new ConflictException(
    `Device ${deviceUid} is already registered`
  );
}
```

### Revoked Device Re-registration

```typescript
// Error: Cannot re-register revoked device
if (existing.status === REVOKED) {
  throw new ConflictException(
    `Device ${deviceUid} has been revoked and cannot be re-registered`
  );
}
```

### Invalid State Transition

```typescript
// Error: Invalid state for operation
if (device.status !== ACTIVE) {
  throw new BadRequestException(
    `Device is not active (current status: ${device.status})`
  );
}
```

## Security Implications

### LOCKED State

- **Security**: Device registered but not operational
- **Risk**: Low (device cannot connect)
- **Action**: Complete registration to activate

### ACTIVE State

- **Security**: Device operational and streaming
- **Risk**: Medium (device can send data)
- **Action**: Monitor for anomalies, revoke if compromised

### REVOKED State

- **Security**: Device permanently disabled
- **Risk**: None (device cannot connect)
- **Action**: None (permanent state)

## Monitoring

### State Distribution

```sql
SELECT status, COUNT(*) as count
FROM securebands
WHERE jail_id = 'jail-uuid'
GROUP BY status;
```

### State Transitions

```sql
SELECT 
    action,
    old_values->>'status' as old_status,
    new_values->>'status' as new_status,
    timestamp
FROM admin_audit_log
WHERE resource_type = 'secureband'
    AND action IN ('secureband_added', 'secureband_removed')
ORDER BY timestamp DESC;
```

---

For API usage, see `docs/SECUREBAND_DEVICE_MANAGEMENT.md`
