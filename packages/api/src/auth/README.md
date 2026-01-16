# Authentication Module

Jail-locked authentication system for PulseCal SecureBand on-premise deployment.

## Features

- ✅ Single role: `JAIL_ADMIN`
- ✅ Jail name + password authentication
- ✅ Argon2 password hashing
- ✅ One active session per jail
- ✅ Rate-limited login attempts (5 attempts per 15 minutes)
- ✅ IP-restricted access (LAN only)
- ✅ Session invalidation on password change
- ✅ No self-registration

## Database Setup

1. Run the authentication schema:
```bash
psql -U postgres -d pulsecal_secureband -f database/auth_schema.sql
```

2. Create an initial jail (see `database/seed_jail.sql` or use the script):
```bash
ts-node src/auth/scripts/create-jail.ts "Main Jail" "SecurePassword123!"
```

## API Endpoints

### POST /auth/login

Authenticate a jail and create a session.

**Request:**
```json
{
  "jailName": "Main Jail",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "token": "abc123...",
  "expiresAt": "2024-01-01T12:00:00Z",
  "jailName": "Main Jail"
}
```

**Headers:**
```
Authorization: Bearer <token>
```

### POST /auth/logout

Invalidate the current session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```
204 No Content
```

## Usage in Controllers

### Protect a route:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth/guards/auth.guard';
import { CurrentJail } from './auth/decorators/current-jail.decorator';

@Controller('protected')
@UseGuards(AuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@CurrentJail() jail: { id: string; name: string }) {
    return {
      jailId: jail.id,
      jailName: jail.name,
    };
  }
}
```

## Configuration

### Environment Variables

```env
# IP restriction (comma-separated CIDR ranges)
AUTH_ALLOWED_IP_RANGES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32

# Session duration (milliseconds, default: 8 hours)
AUTH_SESSION_DURATION_MS=28800000

# Rate limiting (default: 5 attempts per 15 minutes)
AUTH_MAX_LOGIN_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW_MS=900000
```

## Security Features

1. **Argon2 Password Hashing**
   - Type: argon2id
   - Memory cost: 64 MB
   - Time cost: 3
   - Parallelism: 4

2. **Rate Limiting**
   - Maximum 5 failed attempts per 15 minutes per IP
   - Automatic cleanup of old attempts

3. **IP Restriction**
   - Only allows connections from configured IP ranges
   - Default: Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)

4. **Session Management**
   - One active session per jail
   - Sessions invalidated on password change
   - Sessions expire after 8 hours (configurable)
   - Last accessed time tracked

5. **Audit Trail**
   - All login attempts logged
   - Success/failure tracked
   - IP address and user agent recorded

## Password Management

### Change Password (requires authentication)

```typescript
// This would be added to a profile/settings controller
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
}
```

## Database Tables

- `jails` - Jail accounts
- `sessions` - Active sessions (one per jail)
- `login_attempts` - Login attempt history (for rate limiting)

## Notes

- Sessions are stored in the database (not JWT)
- Session tokens are 64-character hex strings (256 bits)
- Old login attempts are automatically cleaned up (older than 1 hour)
- All password changes invalidate existing sessions
