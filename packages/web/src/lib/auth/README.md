# Authentication Library

Client-side authentication utilities for PulseCal SecureBand.

## Features

- ✅ Session management (localStorage)
- ✅ Auto-logout on inactivity (8 hours)
- ✅ Session expiration checking
- ✅ Route protection
- ✅ Error handling without information leakage

## Usage

### Auth Context

The `AuthProvider` wraps the application and provides authentication state:

```tsx
import { AuthProvider } from '@/lib/auth/auth-context';

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
```

### Use Auth Hook

```tsx
import { useAuth } from '@/lib/auth/auth-context';

function MyComponent() {
  const { session, isAuthenticated, login, logout } = useAuth();
  
  // Access session data
  const jailName = session?.jailName;
  
  // Login
  await login('Jail Name', 'password');
  
  // Logout
  await logout();
}
```

### Route Protection

The `RouteGuard` component automatically protects routes:

```tsx
import { RouteGuard } from '@/components/auth/route-guard';

export default function Layout({ children }) {
  return (
    <RouteGuard>
      {children}
    </RouteGuard>
  );
}
```

## Session Management

Sessions are stored in `localStorage` with the key `pulsecal_session`.

### Session Structure

```typescript
interface Session {
  token: string;
  expiresAt: Date;
  jailName: string;
}
```

### Auto-Logout

- **Inactivity Timeout**: 8 hours (matches backend session duration)
- **Activity Tracking**: Mouse, keyboard, scroll, touch events
- **Check Interval**: Every minute

## API Integration

The `authService` handles all API communication:

- `login(jailName, password)` - Authenticate and get session
- `logout(token)` - Invalidate session
- `validateSession(token)` - Check if session is still valid

## Error Handling

Errors are handled without leaking information:

- **401**: "Invalid jail name or password"
- **429**: "Too many login attempts. Please try again later."
- **403**: "Access denied: IP address not allowed"
- **Network**: "Network error. Please check your connection and try again."

## Configuration

Set `NEXT_PUBLIC_API_URL` environment variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
