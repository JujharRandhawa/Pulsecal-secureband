# PulseCal SecureBand Desktop Application

Native desktop application built with Electron for on-premise jail deployment.

## Features

- ✅ Native desktop application (no browser required)
- ✅ Automatic backend service startup
- ✅ Offline operation
- ✅ Secure local-only communication
- ✅ Professional UI/UX
- ✅ Kiosk mode support
- ✅ One-click installation

## Architecture

The desktop application consists of:

1. **Electron Main Process** (`src/main.ts`)
   - Manages application lifecycle
   - Starts backend services (API, AI Services)
   - Creates and manages windows
   - Handles IPC communication

2. **Electron Preload Script** (`src/preload.ts`)
   - Secure bridge between renderer and main process
   - Exposes safe API to frontend

3. **Frontend** (Next.js app from `packages/web`)
   - Loaded in Electron renderer process
   - Communicates with backend via localhost
   - No browser-specific code

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.11+ (for AI services)
- PostgreSQL (for database)
- Redis (for caching)

### Setup

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm --filter shared build

# Build API
pnpm --filter api build

# Build web frontend
pnpm --filter web build

# Build desktop app
cd packages/desktop
pnpm build
```

### Run in Development

```bash
cd packages/desktop
pnpm dev
```

This will:
1. Start API service (port 3001)
2. Start AI Services (port 8000)
3. Start Next.js dev server (port 3000)
4. Open Electron window

## Building for Production

### Build All Components

```bash
# From root directory
pnpm --filter shared build
pnpm --filter api build
pnpm --filter web build
cd packages/desktop
pnpm build
```

### Package Application

**Windows:**
```bash
pnpm package:win
```

**Linux:**
```bash
pnpm package:linux
```

**All platforms:**
```bash
pnpm package:all
```

Output will be in `packages/desktop/out/` directory.

## Installation

### Windows

1. Run the `.exe` installer from `out/` directory
2. Follow installation wizard
3. Launch from desktop shortcut or Start Menu

### Linux

**AppImage:**
1. Download `.AppImage` file
2. Make executable: `chmod +x PulseCal-SecureBand-*.AppImage`
3. Run: `./PulseCal-SecureBand-*.AppImage`

**Debian Package:**
1. Install: `sudo dpkg -i pulsecal-secureband_*.deb`
2. Launch from applications menu

## Configuration

The application uses environment variables for configuration. In production, these are set automatically. For custom configuration, edit the environment in `src/main.ts`.

### Ports

- Web: 3000
- API: 3001
- AI Services: 8000

### Database

Default PostgreSQL connection:
- Host: localhost
- Port: 5432
- Database: pulsecal
- Username: postgres
- Password: Set via `DB_PASSWORD` environment variable

## Security

- ✅ No external network access
- ✅ Backend only accessible via localhost
- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Secure IPC communication
- ✅ Jail-only authentication

## Troubleshooting

### Services Not Starting

1. Check that PostgreSQL and Redis are running
2. Verify ports 3000, 3001, 8000 are available
3. Check console output for error messages

### Application Won't Launch

1. Check Node.js version: `node --version` (must be 18+)
2. Verify all dependencies are installed: `pnpm install`
3. Check build output for errors

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify database credentials
3. Check database exists: `psql -U postgres -l`

## Development Notes

- The main process starts backend services as child processes
- Services are automatically stopped when app closes
- In development, services run via pnpm
- In production, services run from built executables
- Frontend is served via Next.js (dev) or static files (prod)
