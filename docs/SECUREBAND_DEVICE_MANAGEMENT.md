# SecureBand Device Management

## Overview

Complete device ownership and lifecycle control system for PulseCal SecureBand wearable devices in prison environments.

## Device Lifecycle

```
┌─────────┐
│  NEW    │
└────┬────┘
     │
     │ Manual Add
     ▼
┌─────────┐
│ LOCKED  │ ← Initial registration
└────┬────┘
     │
     │ Auto-activate
     ▼
┌─────────┐
│ ACTIVE  │ ← Can connect and stream
└────┬────┘
     │
     │ Manual Remove
     ▼
┌─────────┐
│ REVOKED │ ← Cannot reconnect
└─────────┘
```

## State Machine

### States

1. **LOCKED**
   - Device registered but not yet active
   - Cannot connect
   - Waiting for activation

2. **ACTIVE**
   - Device is active and operational
   - Can connect and stream data
   - Authentication tokens valid

3. **REVOKED**
   - Device has been removed/revoked
   - Cannot reconnect
   - Permanent state (cannot be reactivated)

### Transitions

| From | To | Trigger | Conditions |
|------|-----|---------|------------|
| - | LOCKED | Initial registration | Device UID unique |
| LOCKED | ACTIVE | Successful add | Auto-activation |
| ACTIVE | REVOKED | Manual remove | Requires reason |

## API Endpoints

### Add SecureBand

**Endpoint**: `POST /api/securebands`

**Request**:
```json
{
  "deviceUid": "SB-12345-ABCD",
  "firmwareVersion": "1.2.3",
  "publicKey": "device-public-key-base64"
}
```

**Response**:
```json
{
  "id": "uuid",
  "deviceUid": "SB-12345-ABCD",
  "jailId": "uuid",
  "status": "ACTIVE",
  "boundAt": "2024-01-01T00:00:00Z",
  "firmwareVersion": "1.2.3",
  "token": "auth-token",
  "tokenExpiresAt": "2025-01-01T00:00:00Z",
  "nonceSeed": "seed-for-nonce-generation"
}
```

**Errors**:
- `409 Conflict`: Device already registered
- `403 Forbidden`: Forensic mode active
- `400 Bad Request`: Invalid device UID format

### Remove SecureBand

**Endpoint**: `POST /api/securebands/:deviceUid/remove`

**Request**:
```json
{
  "reason": "Device malfunction - requires replacement"
}
```

**Response**:
```json
{
  "id": "uuid",
  "deviceUid": "SB-12345-ABCD",
  "status": "REVOKED",
  "removedAt": "2024-01-01T00:00:00Z",
  "removalReason": "Device malfunction - requires replacement"
}
```

**Errors**:
- `404 Not Found`: Device not found
- `400 Bad Request`: Device already revoked
- `403 Forbidden`: Forensic mode active

### Get SecureBand

**Endpoint**: `GET /api/securebands/:deviceUid`

**Response**:
```json
{
  "id": "uuid",
  "deviceUid": "SB-12345-ABCD",
  "jailId": "uuid",
  "jailName": "Main Jail",
  "status": "ACTIVE",
  "boundAt": "2024-01-01T00:00:00Z",
  "lastSeen": "2024-01-01T12:00:00Z",
  "firmwareVersion": "1.2.3"
}
```

### List SecureBands

**Endpoint**: `GET /api/securebands?status=ACTIVE`

**Query Parameters**:
- `status` (optional): Filter by status (LOCKED, ACTIVE, REVOKED)

**Response**:
```json
[
  {
    "id": "uuid",
    "deviceUid": "SB-12345-ABCD",
    "status": "ACTIVE",
    "lastSeen": "2024-01-01T12:00:00Z"
  }
]
```

## Device Authentication

### Authentication Headers

Devices must include these headers for all API requests:

```
X-Device-UID: SB-12345-ABCD
X-Device-Token: <auth-token>
X-Device-Nonce: <nonce>
```

### Authentication Flow

1. **Registration**: Device provides UID and public key
2. **Token Issuance**: Server generates jail-bound auth token
3. **Connection**: Device uses token + nonce for each request
4. **Validation**: Server validates token, nonce, and status
5. **Update**: Server updates last_seen timestamp

### Security Features

#### Mutual Authentication

- Device provides public key during registration
- Server provides public key in token response
- Encrypted communication using public keys

#### Jail-Bound Tokens

- Tokens are cryptographically bound to jail ID
- Tokens cannot be used across different jails
- Token expiration: 1 year (configurable)

#### Replay Attack Protection

- Nonce seed provided during registration
- Each request requires unique nonce
- Nonce validation prevents replay attacks
- Timestamp-based nonce validation

#### Connection Blocking

| Condition | Result |
|-----------|--------|
| Device not registered | Rejected |
| Device status = REVOKED | Rejected |
| Token expired | Rejected |
| Invalid token hash | Rejected |
| Invalid nonce | Rejected |
| Wrong jail ID | Rejected |

## Database Schema

```sql
CREATE TABLE securebands (
    id UUID PRIMARY KEY,
    device_uid VARCHAR(255) UNIQUE NOT NULL,
    jail_id UUID NOT NULL REFERENCES jails(id),
    status ENUM('LOCKED','ACTIVE','REVOKED') DEFAULT 'LOCKED',
    bound_at TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    firmware_version VARCHAR(50),
    public_key TEXT,
    auth_token_hash TEXT,
    token_issued_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ,
    nonce_seed TEXT,
    added_by UUID,
    added_at TIMESTAMPTZ,
    removed_by UUID,
    removed_at TIMESTAMPTZ,
    removal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage Examples

### Add Device (Admin)

```typescript
// Admin adds device
const response = await fetch('/api/securebands', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jailToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceUid: 'SB-12345-ABCD',
    firmwareVersion: '1.2.3',
    publicKey: 'device-public-key-base64',
  }),
});

const { token, tokenExpiresAt, nonceSeed } = await response.json();

// Store token securely on device
// Device can now connect using this token
```

### Device Connection

```typescript
// Device sends telemetry data
const nonce = generateNonce(nonceSeed);

const response = await fetch('/api/telemetry', {
  method: 'POST',
  headers: {
    'X-Device-UID': 'SB-12345-ABCD',
    'X-Device-Token': authToken,
    'X-Device-Nonce': nonce,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    heartRate: 72,
    temperature: 36.5,
    timestamp: new Date().toISOString(),
  }),
});
```

### Remove Device (Admin)

```typescript
// Admin removes device
const response = await fetch('/api/securebands/SB-12345-ABCD/remove', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jailToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    reason: 'Device malfunction - requires replacement',
  }),
});
```

## Security Best Practices

1. **Token Storage**: Store tokens securely on device (encrypted storage)
2. **Token Transmission**: Always use HTTPS/TLS
3. **Nonce Generation**: Implement proper nonce with timestamp
4. **Public Key Exchange**: Use secure key exchange protocol
5. **Token Rotation**: Consider token rotation for long-lived devices
6. **Device Revocation**: Immediately revoke compromised devices

## Environment Variables

```env
DEVICE_AUTH_SECRET=CHANGE_ME_STRONG_SECRET_KEY
SERVER_PUBLIC_KEY=server-public-key-base64
DEVICE_TOKEN_EXPIRY_HOURS=8760  # 1 year
```

## Monitoring

### Active Devices

```sql
SELECT * FROM active_securebands
WHERE jail_id = 'jail-uuid';
```

### Device Lifecycle

```sql
SELECT * FROM secureband_lifecycle
WHERE jail_id = 'jail-uuid'
ORDER BY created_at DESC;
```

### Offline Devices

```sql
SELECT * FROM securebands
WHERE status = 'ACTIVE'
  AND last_seen < NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Device Cannot Connect

1. Check device status (must be ACTIVE)
2. Verify token expiration
3. Check nonce generation
4. Verify jail ID matches

### Duplicate Registration Error

- Device UID already exists and is active/locked
- Check if device was previously registered
- Revoked devices cannot be re-registered

### Token Invalid Error

- Token may have expired
- Token may have been invalidated (device removed)
- Verify token hash matches stored hash

---

For implementation details, see `packages/api/src/secureband/`
