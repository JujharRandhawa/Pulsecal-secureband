# Login UI Implementation

## Overview

Minimal, professional login interface for PulseCal SecureBand jail administration portal.

## Features

✅ **Minimal Design** - Clean, professional interface  
✅ **Jail Name + Password** - Simple authentication form  
✅ **No Signup** - Login only, no registration option  
✅ **No Forgot Password** - Security-focused design  
✅ **Error Feedback** - Generic messages without information leakage  
✅ **Full-Screen Locked** - Blocks access when not authenticated  
✅ **Auto-Logout** - 8-hour inactivity timeout  
✅ **Route Protection** - Automatic redirect to login  

## Components

### Login Page (`/login`)

**Location**: `packages/web/src/app/login/page.tsx`

**Features**:
- Jail Name input field
- Security Password input field
- Error message display
- Loading state during authentication
- Form validation
- Auto-redirect on success

**Styling**: `packages/web/src/app/login/login.module.css`

### Auth Context

**Location**: `packages/web/src/lib/auth/auth-context.tsx`

**Features**:
- Session state management
- Login/logout functions
- Session persistence (localStorage)
- Auto-logout on inactivity
- Session expiration checking

### Route Guard

**Location**: `packages/web/src/components/auth/route-guard.tsx`

**Features**:
- Protects all routes except `/login`
- Redirects to login if not authenticated
- Shows loading state during auth check

### Auth Service

**Location**: `packages/web/src/lib/auth/auth-service.ts`

**Features**:
- API communication
- Session storage/retrieval
- Error handling
- Session validation

## User Flow

```
1. User visits any route
   ↓
2. RouteGuard checks authentication
   ↓
3. Not authenticated → Redirect to /login
   ↓
4. User enters Jail Name + Password
   ↓
5. Submit → API call to /auth/login
   ↓
6. Success → Store session → Redirect to /dashboard
   ↓
7. Failure → Show error message
   ↓
8. Authenticated → Access granted
   ↓
9. Inactivity (8 hours) → Auto-logout
```

## Session Management

### Storage

Sessions are stored in `localStorage` with key `pulsecal_session`:

```json
{
  "token": "abc123...",
  "expiresAt": "2024-01-01T20:00:00.000Z",
  "jailName": "Main Jail"
}
```

### Auto-Logout

- **Inactivity Detection**: Tracks mouse, keyboard, scroll, touch events
- **Timeout**: 8 hours of inactivity
- **Check Interval**: Every minute
- **Expiration Check**: Validates session expiration every minute

### Session Validation

- Validates session on app load
- Checks expiration before rendering protected content
- Automatically logs out if session is invalid

## Error Messages

All error messages are generic to prevent information leakage:

| Error | Message |
|-------|---------|
| Invalid credentials | "Invalid jail name or password" |
| Rate limit | "Too many login attempts. Please try again later." |
| IP blocked | "Access denied: IP address not allowed" |
| Network error | "Network error. Please check your connection and try again." |
| Generic | "Login failed. Please check your credentials and try again." |

## Route Protection

### Automatic Protection

All routes are protected by default except:
- `/login` - Login page
- `/api/*` - API routes
- `/_next/*` - Next.js internal routes

### Manual Protection

Use the `useAuth` hook to check authentication:

```tsx
import { useAuth } from '@/lib/auth/auth-context';

function ProtectedComponent() {
  const { isAuthenticated, session } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please login</div>;
  }
  
  return <div>Welcome, {session?.jailName}</div>;
}
```

## Styling

### Design Principles

- **Minimal**: Clean, uncluttered interface
- **Professional**: Government-grade appearance
- **Accessible**: Proper labels, ARIA attributes
- **Responsive**: Works on all screen sizes

### Color Scheme

- **Primary**: Purple gradient (`#667eea` to `#764ba2`)
- **Background**: White cards on gradient background
- **Text**: Dark gray (`#1a202c`)
- **Error**: Red (`#c53030`)
- **Border**: Light gray (`#e2e8f0`)

## Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Session Duration

Matches backend session duration (8 hours). Configured in:
- `packages/web/src/lib/auth/auth-context.tsx` - `INACTIVITY_TIMEOUT`

## Security Features

1. **No Information Leakage**: Generic error messages
2. **Session Storage**: Secure localStorage usage
3. **Auto-Logout**: Prevents unauthorized access
4. **Route Protection**: Automatic redirects
5. **Token Validation**: Backend session validation
6. **Activity Tracking**: Monitors user activity

## Testing

### Manual Testing

1. **Login Flow**:
   - Visit `/dashboard` → Should redirect to `/login`
   - Enter valid credentials → Should redirect to `/dashboard`
   - Enter invalid credentials → Should show error

2. **Session Persistence**:
   - Login → Refresh page → Should stay logged in
   - Close browser → Reopen → Should stay logged in (until expiration)

3. **Auto-Logout**:
   - Login → Wait 8 hours → Should auto-logout
   - Login → Inactive for 8 hours → Should auto-logout

4. **Route Protection**:
   - Not logged in → Visit any route → Should redirect to `/login`
   - Logged in → Visit `/login` → Should redirect to `/dashboard`

## Files Structure

```
packages/web/src/
├── app/
│   ├── login/
│   │   ├── page.tsx              # Login page component
│   │   └── login.module.css      # Login styles
│   ├── dashboard/
│   │   ├── page.tsx               # Dashboard (protected)
│   │   └── dashboard.module.css   # Dashboard styles
│   ├── layout.tsx                 # Root layout with AuthProvider
│   └── page.tsx                   # Home page (redirects)
├── lib/
│   └── auth/
│       ├── auth-context.tsx       # Auth context provider
│       ├── auth-service.ts        # API service
│       ├── types.ts               # TypeScript types
│       └── README.md              # Documentation
├── components/
│   └── auth/
│       └── route-guard.tsx        # Route protection component
└── middleware.ts                  # Next.js middleware (optional)
```

## Next Steps

1. Add session refresh endpoint (optional)
2. Add "Remember me" functionality (optional)
3. Add session timeout warning (optional)
4. Add activity indicator (optional)
5. Integrate with dashboard components

---

For API authentication details, see `docs/AUTHENTICATION.md`
