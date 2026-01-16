# PulseCal SecureBand - Authentication System

## Overview

Jail-locked authentication system designed for on-premise prison deployments. This system provides secure, single-role authentication with strict access controls.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              IP Restriction Guard                        │
│  - Validates IP against allowed ranges                  │
│  - Blocks unauthorized IPs                              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Login Endpoint                              │
│  - Validates jail name + password                       │
│  - Checks rate limits                                   │
│  - Creates session                                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Auth Guard (Protected Routes)              │
│  - Validates session token                              │
│  - Checks expiration                                    │
│  - Attaches jail context                                │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

1. **jails**
   - Stores jail accounts
   - Argon2 password hashes
   - Password change timestamps

2. **sessions**
   - One active session per jail (enforced by unique index)
   - Session tokens (64-char hex)
   - IP address and user agent tracking
   - Expiration timestamps

3. **login_attempts**
   - Rate limiting data
   - Success/failure tracking
   - Automatic cleanup (1 hour retention)

### Schema File

See `database/auth_schema.sql` for complete schema definition.

## Security Features

### 1. Argon2 Password Hashing

- **Algorithm**: argon2id (resistant to both GPU and side-channel attacks)
- **Memory Cost**: 64 MB
- **Time Cost**: 3 iterations
- **Parallelism**: 4 threads

### 2. Rate Limiting

- **Limit**: 5 failed attempts per 15 minutes per IP
- **Scope**: Per jail name + IP address combination
- **Storage**: Database-backed (survives restarts)
- **Cleanup**: Automatic removal of attempts older than 1 hour

### 3. IP Restriction

- **Default**: Private IP ranges only
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
  - `127.0.0.1/32` (localhost)
- **Configurable**: Via `AUTH_ALLOWED_IP_RANGES` environment variable
- **Format**: Comma-separated CIDR ranges

### 4. Session Management

- **One Session Per Jail**: New login invalidates previous session
- **Session Duration**: 8 hours (configurable)
- **Token Format**: 64-character hex string (256 bits)
- **Storage**: Database (not stateless JWT)
- **Invalidation**: On password change, logout, or expiration

### 5. Audit Trail

- All login attempts logged
- Success/failure tracked
- IP address and user agent recorded
- Failure reasons stored

## API Endpoints

### POST /auth/login

Authenticate and create a session.

**Request Body:**
```json
{
  "jailName": "Main Jail",
  "password": "SecurePassword123!"
}
```

**Success Response (200):**
```json
{
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2024-01-01T20:00:00.000Z",
  "jailName": "Main Jail"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid jail name or password
- `429 Too Many Requests`: Rate limit exceeded
- `403 Forbidden`: IP address not allowed

**Headers:**
```
Content-Type: application/json
```

### POST /auth/logout

Invalidate current session.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token

## Usage Examples

### Protect a Route

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth/guards/auth.guard';
import { CurrentJail } from './auth/decorators/current-jail.decorator';

@Controller('api/dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  @Get()
  getDashboard(@CurrentJail() jail: { id: string; name: string }) {
    return {
      message: `Welcome, ${jail.name}`,
      jailId: jail.id,
    };
  }
}
```

### Access Session Information

```typescript
import { Request } from '@nestjs/common';
import { AuthenticatedRequest } from './auth/guards/auth.guard';

@Controller('api/profile')
@UseGuards(AuthGuard)
export class ProfileController {
  @Get()
  getProfile(@Request() req: AuthenticatedRequest) {
    const session = req.session;
    return {
      jailId: session.jailId,
      jailName: session.jail.name,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
    };
  }
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd packages/api
pnpm install argon2
```

### 2. Run Database Migration

```bash
psql -U postgres -d pulsecal_secureband -f database/auth_schema.sql
```

### 3. Create Initial Jail

**Option A: Using the script**
```bash
cd packages/api
ts-node src/auth/scripts/create-jail.ts "Main Jail" "SecurePassword123!"
```

**Option B: Manual SQL**
```sql
-- Generate hash first using Node.js:
-- node -e "const argon2 = require('argon2'); argon2.hash('YourPassword', {type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4}).then(console.log)"

INSERT INTO jails (name, password_hash, password_changed_at, is_active)
VALUES (
    'Main Jail',
    '$argon2id$v=19$m=65536,t=3,p=4$...',
    NOW(),
    true
);
```

### 4. Configure Environment Variables

```env
# IP Restriction (comma-separated CIDR ranges)
AUTH_ALLOWED_IP_RANGES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32

# Session Duration (milliseconds, default: 8 hours)
AUTH_SESSION_DURATION_MS=28800000

# Rate Limiting
AUTH_MAX_LOGIN_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MS=900000
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ALLOWED_IP_RANGES` | Private IPs | Comma-separated CIDR ranges |
| `AUTH_SESSION_DURATION_MS` | 28800000 | Session duration in milliseconds (8 hours) |
| `AUTH_MAX_LOGIN_ATTEMPTS` | 5 | Max failed attempts per window |
| `AUTH_RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 minutes) |

## Password Management

### Change Password

Add to a profile/settings controller:

```typescript
@Post('change-password')
@UseGuards(AuthGuard)
async changePassword(
  @CurrentJail() jail: { id: string },
  @Body() dto: { currentPassword: string; newPassword: string },
) {
  await this.authService.changePassword(
    jail.id,
    dto.currentPassword,
    dto.newPassword,
  );
  return { message: 'Password changed successfully' };
}
```

**Note**: Password changes automatically invalidate all existing sessions.

## Monitoring

### Check Active Sessions

```sql
SELECT * FROM active_sessions;
```

### View Recent Failed Logins

```sql
SELECT * FROM recent_failed_logins;
```

### Check Rate Limit Status

```sql
SELECT 
    jail_name,
    ip_address,
    COUNT(*) as attempts,
    MAX(attempted_at) as last_attempt
FROM login_attempts
WHERE success = false
    AND attempted_at > NOW() - INTERVAL '15 minutes'
GROUP BY jail_name, ip_address;
```

## Security Considerations

1. **No Self-Registration**: Jails must be created by administrators
2. **Single Role**: All authenticated users have `JAIL_ADMIN` role
3. **Session Storage**: Sessions stored in database (not stateless)
4. **IP Restriction**: Only LAN access allowed by default
5. **Rate Limiting**: Prevents brute force attacks
6. **Password Hashing**: Argon2 with high memory cost
7. **Session Invalidation**: On password change and logout
8. **Audit Logging**: All login attempts tracked

## Troubleshooting

### "IP address not allowed"

- Check `AUTH_ALLOWED_IP_RANGES` environment variable
- Verify proxy settings (`trust proxy` enabled)
- Check if IP is in allowed CIDR ranges

### "Too many login attempts"

- Wait 15 minutes for rate limit window to reset
- Check `login_attempts` table for recent failures
- Verify IP address is correct

### "Invalid or expired session"

- Session may have expired (8 hours default)
- Session may have been invalidated by password change
- Check `sessions` table for session status

## Files Structure

```
packages/api/src/auth/
├── auth.module.ts              # Module definition
├── auth.service.ts             # Core authentication logic
├── auth.controller.ts          # Login/logout endpoints
├── dto/
│   ├── login.dto.ts           # Login request DTO
│   └── login-response.dto.ts  # Login response DTO
├── entities/
│   ├── jail.entity.ts         # Jail entity
│   ├── session.entity.ts      # Session entity
│   └── login-attempt.entity.ts # Login attempt entity
├── guards/
│   ├── auth.guard.ts          # Session validation guard
│   └── ip-restriction.guard.ts # IP restriction guard
├── decorators/
│   ├── current-jail.decorator.ts # Current jail decorator
│   └── public.decorator.ts     # Public route decorator
└── scripts/
    └── create-jail.ts         # Jail creation script
```

---

For implementation details, see `packages/api/src/auth/README.md`
