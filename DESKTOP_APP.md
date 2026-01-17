# PulseCal SecureBand - Desktop Application

## Overview

The PulseCal SecureBand desktop application is a native Electron-based application designed for on-premise jail deployment. It provides a professional, secure, and offline-capable interface for monitoring and managing SecureBand devices.

## Features

✅ **Native Desktop Application**
- No browser dependency
- Professional native window
- Custom application icon
- Fullscreen/kiosk mode support

✅ **Automatic Backend Management**
- API server starts automatically
- AI services start automatically
- All services stop gracefully on exit
- No manual configuration required

✅ **Security**
- Local-only communication (no external network)
- Jail-only authentication
- Secure IPC communication
- Context isolation enabled

✅ **Professional UI/UX**
- Modern, clean interface
- Fast startup time
- Responsive design
- Admin-focused dashboards

✅ **Easy Deployment**
- One-click installer (.exe for Windows)
- One-click launch
- No runtime setup required
- Offline operation

## Architecture

```
┌─────────────────────────────────────┐
│     Electron Main Process            │
│  - Starts API service (port 3001)    │
│  - Starts AI Services (port 8000)    │
│  - Manages application lifecycle    │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     Electron Renderer Process       │
│  - Next.js frontend (port 3000)     │
│  - Secure IPC communication         │
│  - Professional UI                  │
└─────────────────────────────────────┘
```

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Build all components
pnpm desktop:build

# Run in development mode
pnpm desktop:dev
```

### Production Build

```bash
# Build Windows installer
pnpm desktop:package:win

# Build Linux AppImage/Deb
pnpm desktop:package:linux

# Build all platforms
pnpm desktop:package:all
```

## Installation

### Windows

1. Download `PulseCal-SecureBand-Setup-x.x.x.exe`
2. Run the installer
3. Follow installation wizard
4. Launch from desktop shortcut

### Linux

**AppImage:**
```bash
chmod +x PulseCal-SecureBand-*.AppImage
./PulseCal-SecureBand-*.AppImage
```

**Debian Package:**
```bash
sudo dpkg -i pulsecal-secureband_*.deb
```

## Configuration

### Ports

The application uses fixed ports (configurable in `packages/desktop/src/main.ts`):

- **Web Frontend:** 3000
- **API Server:** 3001
- **AI Services:** 8000

### Database

Default PostgreSQL configuration:
- Host: localhost
- Port: 5432
- Database: pulsecal
- Username: postgres
- Password: Set via environment variable

### Environment Variables

The application reads from environment variables. In production, these are set automatically. For custom configuration, modify `packages/desktop/src/main.ts`.

## Security Features

1. **No External Network Access**
   - All communication is localhost-only
   - No external API calls
   - No telemetry or tracking

2. **Jail-Only Authentication**
   - Jail name + security password
   - No email login
   - No public endpoints

3. **Secure IPC**
   - Context isolation enabled
   - Node integration disabled
   - Preload script for safe API exposure

4. **Device Management**
   - One SecureBand per system
   - Manual add/remove only
   - Ownership enforcement

## Kiosk Mode

Enable kiosk mode for dedicated monitoring stations:

```typescript
// In renderer process
window.electronAPI.setKiosk(true);
```

Kiosk mode:
- Fullscreen application
- No window controls
- No taskbar access
- Perfect for dedicated monitoring stations

## Troubleshooting

### Services Not Starting

1. **Check Prerequisites:**
   - PostgreSQL running: `pg_isready`
   - Redis running: `redis-cli ping`
   - Ports available: `netstat -ano | findstr :3001`

2. **Check Logs:**
   - Open DevTools (Ctrl+Shift+I)
   - Check Console for errors
   - Check Main Process logs

3. **Verify Installation:**
   - Ensure all dependencies installed
   - Verify database exists
   - Check environment variables

### Application Won't Launch

1. **Check Node.js:**
   ```bash
   node --version  # Must be 18+
   ```

2. **Rebuild Application:**
   ```bash
   pnpm desktop:build
   ```

3. **Check Antivirus:**
   - Some antivirus software blocks Electron apps
   - Add exception if needed

### Database Connection Issues

1. **Verify PostgreSQL:**
   ```bash
   psql -U postgres -l
   ```

2. **Check Credentials:**
   - Default: postgres/postgres
   - Modify in `src/main.ts` if different

3. **Create Database:**
   ```sql
   CREATE DATABASE pulsecal;
   ```

## Development

### Project Structure

```
packages/desktop/
├── src/
│   ├── main.ts          # Electron main process
│   └── preload.ts       # Preload script (IPC bridge)
├── build/
│   ├── icon.ico         # Windows icon
│   └── icon.png         # Linux icon
├── dist/                # Compiled output
├── out/                 # Built installers
└── package.json         # Electron configuration
```

### Building

1. **Build Shared Package:**
   ```bash
   pnpm --filter shared build
   ```

2. **Build API:**
   ```bash
   pnpm --filter api build
   ```

3. **Build Web Frontend:**
   ```bash
   ELECTRON_BUILD=true pnpm --filter web build
   ```

4. **Build Desktop App:**
   ```bash
   cd packages/desktop
   pnpm build
   ```

### Packaging

```bash
# Windows
pnpm desktop:package:win

# Linux
pnpm desktop:package:linux

# All platforms
pnpm desktop:package:all
```

## Production Deployment

### Requirements

- Windows 10/11 or Linux (Ubuntu 20.04+)
- PostgreSQL 14+
- Redis 7+
- Python 3.11+ (for AI services)
- 4GB RAM minimum
- 10GB disk space

### Installation Steps

1. Install PostgreSQL and Redis
2. Create database: `CREATE DATABASE pulsecal;`
3. Run database migrations (from `database/` folder)
4. Install desktop application
5. Launch application
6. Login with jail credentials

## Support

For issues or questions:
- Check logs in DevTools (Ctrl+Shift+I)
- Review `packages/desktop/README.md`
- Check main repository README

## License

Proprietary - Government Use Only
