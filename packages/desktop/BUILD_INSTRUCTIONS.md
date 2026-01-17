# Build Instructions for PulseCal SecureBand Desktop Application

## Prerequisites

1. **Node.js** 18.0.0 or higher
2. **pnpm** 8.0.0 or higher
3. **Python** 3.11+ (for AI services)
4. **PostgreSQL** 14+ (for database)
5. **Redis** 7+ (for caching)

## Step-by-Step Build Process

### 1. Install Dependencies

```bash
# From project root
pnpm install
```

### 2. Build Shared Package

```bash
pnpm --filter shared build
```

### 3. Build API Backend

```bash
pnpm --filter api build
```

### 4. Build Web Frontend (for Electron)

```bash
# Set Electron build flag
cd packages/web
ELECTRON_BUILD=true pnpm build
cd ../..
```

### 5. Build Desktop Application

```bash
cd packages/desktop
pnpm build
```

This will:
- Compile TypeScript (`main.ts` → `dist/main.js`)
- Build preload script (`preload.ts` → `dist/preload.js`)

### 6. Package Application

**For Windows:**
```bash
pnpm package:win
```

**For Linux:**
```bash
pnpm package:linux
```

**For All Platforms:**
```bash
pnpm package:all
```

## Quick Build (All-in-One)

From project root:

```bash
# Build everything
pnpm desktop:build

# Or use the desktop package script
pnpm desktop:package:win
```

## Development Mode

To run in development mode (with hot reload):

```bash
pnpm desktop:dev
```

This will:
1. Compile TypeScript
2. Build preload script
3. Start API service (via pnpm)
4. Start AI Services (via Python)
5. Start Next.js dev server
6. Open Electron window

## Production Build Checklist

- [ ] All dependencies installed
- [ ] Shared package built
- [ ] API backend built
- [ ] Web frontend built with `ELECTRON_BUILD=true`
- [ ] Desktop app compiled
- [ ] Icons added (`build/icon.ico` and `build/icon.png`)
- [ ] Tested in development mode
- [ ] Application packaged
- [ ] Installer tested

## Icon Requirements

Before packaging, ensure you have:

1. **Windows Icon:** `packages/desktop/build/icon.ico`
   - Multiple sizes: 16x16, 32x32, 48x48, 256x256
   - Use online converter or ImageMagick

2. **Linux Icon:** `packages/desktop/build/icon.png`
   - Size: 512x512 pixels
   - PNG format with transparency

See `packages/desktop/ICON_GUIDE.md` for detailed instructions.

## Troubleshooting

### Build Fails

1. **Check Node.js version:**
   ```bash
   node --version  # Must be 18+
   ```

2. **Clear build artifacts:**
   ```bash
   pnpm clean
   pnpm --filter desktop clean
   ```

3. **Rebuild from scratch:**
   ```bash
   rm -rf node_modules packages/*/node_modules
   pnpm install
   pnpm desktop:build
   ```

### Services Don't Start

1. **Check PostgreSQL:**
   ```bash
   pg_isready
   ```

2. **Check Redis:**
   ```bash
   redis-cli ping
   ```

3. **Check ports:**
   ```bash
   netstat -ano | findstr :3001
   ```

### Packaging Fails

1. **Check electron-builder:**
   ```bash
   npx electron-builder --version
   ```

2. **Clear cache:**
   ```bash
   rm -rf packages/desktop/out
   rm -rf packages/desktop/dist
   ```

3. **Rebuild:**
   ```bash
   pnpm desktop:build
   pnpm desktop:package:win
   ```

## Output Locations

- **Windows Installer:** `packages/desktop/out/PulseCal-SecureBand-Setup-x.x.x.exe`
- **Linux AppImage:** `packages/desktop/out/PulseCal-SecureBand-x.x.x.AppImage`
- **Linux Deb:** `packages/desktop/out/pulsecal-secureband_x.x.x_amd64.deb`

## Next Steps

After building:
1. Test the installer on a clean system
2. Verify all services start correctly
3. Test authentication and device management
4. Deploy to target system
