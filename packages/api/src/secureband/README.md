# SecureBand Device Management

Device ownership and lifecycle control for PulseCal SecureBand devices.

## Features

- ✅ Unique device UID registration
- ✅ Jail-bound device ownership
- ✅ Manual add/remove only
- ✅ Duplicate prevention across systems
- ✅ State machine: LOCKED → ACTIVE → REVOKED
- ✅ Mutual authentication
- ✅ Jail-bound authorization tokens
- ✅ Replay attack protection

## Device States

```
LOCKED → (add) → ACTIVE → (remove) → REVOKED
```

- **LOCKED**: Device registered but not yet activated
- **ACTIVE**: Device active and streaming data
- **REVOKED**: Device removed/revoked, cannot reconnect

## API Endpoints

### Add SecureBand

```http
POST /securebands
Authorization: Bearer <jail-token>
Content-Type: application/json

{
  "deviceUid": "SB-12345-ABCD",
  "firmwareVersion": "1.2.3",
  "publicKey": "device-public-key-base64"
}
```

**Response:**
```json
{
  "id": "uuid",
  "deviceUid": "SB-12345-ABCD",
  "jailId": "uuid",
  "status": "ACTIVE",
  "token": "auth-token",
  "tokenExpiresAt": "2025-01-01T00:00:00Z",
  "nonceSeed": "seed-for-nonce-generation"
}
```

### Remove SecureBand

```http
POST /securebands/:deviceUid/remove
Authorization: Bearer <jail-token>
Content-Type: application/json

{
  "reason": "Device malfunction - requires replacement"
}
```

### Get SecureBand

```http
GET /securebands/:deviceUid
Authorization: Bearer <jail-token>
```

### List SecureBands

```http
GET /securebands?status=ACTIVE
Authorization: Bearer <jail-token>
```

## Device Authentication

Devices authenticate using:

1. **Device UID**: Unique identifier
2. **Auth Token**: Jail-bound authorization token
3. **Nonce**: Replay attack protection

### Headers Required

```
X-Device-UID: SB-12345-ABCD
X-Device-Token: <auth-token>
X-Device-Nonce: <nonce>
```

### Authentication Flow

1. Device sends credentials in headers
2. Server validates token and nonce
3. Server checks device status (must be ACTIVE)
4. Server updates last_seen timestamp
5. Request proceeds if valid

## Security Features

### Mutual Authentication

- Device provides public key during registration
- Server provides public key in token response
- Encrypted communication using public keys

### Jail-Bound Tokens

- Tokens are bound to specific jail
- Tokens expire after 1 year (configurable)
- Token invalidation on device removal

### Replay Attack Protection

- Nonce seed provided during registration
- Each request requires unique nonce
- Nonce validation prevents replay attacks

### Connection Blocking

- Unregistered devices: Rejected
- Revoked devices: Rejected
- Expired tokens: Rejected
- Wrong jail: Rejected

## State Machine

### Transitions

| From | To | Trigger | Notes |
|------|-----|---------|-------|
| - | LOCKED | Initial registration | Default state |
| LOCKED | ACTIVE | Successful add | Auto-activation |
| ACTIVE | REVOKED | Manual remove | Cannot reconnect |
| REVOKED | - | - | Cannot be reactivated |

### State Rules

- **LOCKED**: Device registered but not active
- **ACTIVE**: Device can connect and stream data
- **REVOKED**: Device permanently disabled

## Usage Examples

### Add Device

```typescript
const response = await fetch('/api/securebands', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jailToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceUid: 'SB-12345-ABCD',
    firmwareVersion: '1.2.3',
    publicKey: 'device-public-key',
  }),
});
```

### Device Connection

```typescript
// Device sends data with authentication
const response = await fetch('/api/telemetry', {
  method: 'POST',
  headers: {
    'X-Device-UID': 'SB-12345-ABCD',
    'X-Device-Token': authToken,
    'X-Device-Nonce': generateNonce(),
  },
  body: JSON.stringify(telemetryData),
});
```

## Database Schema

See `database/secureband_schema.sql` for complete schema.

## Security Considerations

1. **Token Storage**: Tokens are hashed before storage
2. **Token Transmission**: Use secure channels (HTTPS/TLS)
3. **Nonce Generation**: Implement proper nonce validation
4. **Public Key Exchange**: Use secure key exchange protocol
5. **Token Expiration**: Tokens expire after 1 year

## Environment Variables

```env
DEVICE_AUTH_SECRET=CHANGE_ME_STRONG_SECRET
SERVER_PUBLIC_KEY=server-public-key-base64
```

---

For complete documentation, see `docs/OPERATIONAL_HARDENING.md`
