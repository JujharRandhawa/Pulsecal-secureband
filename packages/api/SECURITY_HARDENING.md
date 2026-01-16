# Security Hardening Summary

This document summarizes the security audit and hardening performed on the PulseCal SecureBand API.

## 1. Authentication Model

### Jail-Only Authentication
- **No email login**: The system uses jail-based authentication only
- **Jail credentials**: Each jail facility has a unique name and password
- **Session tokens**: 8-hour session tokens with automatic invalidation
- **Rate limiting**: Failed login attempts are rate-limited (5 attempts per 15 minutes)
- **IP restriction**: Login is restricted to configured IP ranges (private networks by default)

### Device Authentication
- **SecureBand tokens**: Devices authenticate using unique tokens issued during registration
- **Token hashing**: Tokens are stored as SHA-256 hashes
- **Nonce validation**: Replay attack protection via nonce seeds
- **Token expiration**: Device tokens expire after 1 year or upon revocation

## 2. Authorization Model

### Simplified Role Structure
- **Single role**: "Jail Admin" - each authenticated jail has full admin access to their own resources
- **Ownership scoping**: All API calls are automatically scoped to the authenticated jail's resources
- **No complex RBAC**: Removed unused role/permission system to reduce attack surface

### Guards Implemented
| Guard | Purpose | Applied To |
|-------|---------|-----------|
| `AuthGuard` | Validates jail session tokens | All jail-facing endpoints |
| `DeviceAuthGuard` | Validates device tokens | Data ingestion endpoints |
| `IpRestrictionGuard` | Restricts login to allowed IPs | Login endpoint |

## 3. Ownership Verification

### Device Ownership Checks
All device operations verify ownership through the `SecureBand` registry:

```typescript
// Every device operation verifies jail ownership
private async verifyDeviceOwnership(deviceId: string, jailId: string): Promise<SecureBand>
```

### Protected Endpoints

| Controller | Guard | Ownership Check |
|-----------|-------|-----------------|
| `SecureBandController` | `AuthGuard` | Via `@CurrentJail()` |
| `DeviceManagementController` | `AuthGuard` | In service layer |
| `DeviceManagementPanelController` | `AuthGuard` | In service layer |
| `IngestionController` | `DeviceAuthGuard` | Via device token |
| `AuditController` | `AuthGuard` | Scoped to jail |
| `ForensicController` | `AuthGuard` | Scoped to jail |

## 4. Revoked Device Prevention

### Device Revocation Flow
1. Device marked as `REVOKED` in `devices` table
2. SecureBand entry marked as `REVOKED`
3. Auth token hash set to `null`
4. Token expiration set to current time

### Reconnection Prevention
```typescript
// In SecureBandService.validateDeviceAuth()
if (secureBand.status !== SecureBandStatus.ACTIVE) {
  return { valid: false };
}
```

### Cannot Re-register Revoked Devices
```typescript
if (existing.status === SecureBandStatus.REVOKED) {
  throw new ConflictException(
    `Device ${deviceUid} has been revoked and cannot be re-registered`,
  );
}
```

## 5. Graceful Offline Handling

### Device Health Monitoring
- **Check interval**: Every 30 seconds
- **Degraded threshold**: 2 minutes without data
- **Offline threshold**: 5 minutes without data

### Graceful Degradation Features
- Devices marked as offline without crashing
- Alerts created with cooldown period (15 minutes)
- WebSocket notifications for real-time UI updates
- Automatic alert resolution on reconnection

### Health Status Types
| Status | Condition |
|--------|-----------|
| `ONLINE` | Data received within 2 minutes |
| `DEGRADED` | No data for 2-5 minutes |
| `OFFLINE` | No data for 5+ minutes |
| `UNKNOWN` | Device not registered for monitoring |

## 6. Removed Dead Code

### Deleted Files
- `app.controller.ts` - Unauthenticated root endpoint
- `app.service.ts` - Unused service
- `public.decorator.ts` - Unused decorator that bypasses auth

### Cleaned Up Module
- Removed `AppController` and `AppService` from `AppModule`
- Added missing module imports (AuthModule, AuditModule, etc.)

## 7. Public Endpoints

The following endpoints remain intentionally public for operational needs:

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Full health check for monitoring |
| `GET /health/liveness` | Kubernetes liveness probe |
| `GET /health/readiness` | Kubernetes readiness probe |
| `GET /health/startup` | Kubernetes startup probe |
| `GET /metrics` | Prometheus metrics scraping |

## 8. Audit Trail

All sensitive operations are logged:

### Critical Actions (Immutable Audit Log)
- SecureBand registration/revocation
- Device binding/unbinding
- Forensic mode changes

### Standard Actions
- Device status updates
- Session creation/destruction
- Configuration changes

## 9. Security Best Practices Applied

1. **Defense in depth**: Multiple layers of authentication and authorization
2. **Principle of least privilege**: Each jail can only access their own devices
3. **Fail secure**: Unknown/unauthenticated requests are rejected
4. **Audit everything**: All operations are logged for forensic analysis
5. **No secrets in code**: All sensitive values are in environment variables
6. **Token rotation**: Device tokens have expiration, session tokens are short-lived

## 10. Environment Variables Required

```bash
# Authentication
DEVICE_AUTH_SECRET=<strong-random-secret>
SERVER_PUBLIC_KEY=<server-public-key>
AUTH_ALLOWED_IP_RANGES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

# Rate limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

## Future Recommendations

1. **Implement proper nonce validation** with timestamp checking
2. **Add MFA** for high-security jail facilities
3. **Implement certificate pinning** for device-to-server communication
4. **Add intrusion detection** rules for suspicious patterns
5. **Regular security audits** and penetration testing
