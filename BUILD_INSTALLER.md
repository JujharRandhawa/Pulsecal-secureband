# Building PulseCal SecureBand Desktop Installer

## Quick Build (Recommended)

Run the automated build script:

```powershell
cd packages\desktop
.\scripts\build-installer.ps1
```

This will:
1. Build all dependencies (shared, API, web)
2. Build the desktop app
3. Generate application icons
4. Create a Windows installer (.exe)

The installer will be created in `packages/desktop/out/`

## Manual Build Steps

If you prefer to build manually:

1. **Build all packages:**
   ```powershell
   pnpm --filter shared build
   pnpm --filter api build
   pnpm --filter web build
   ```

2. **Build desktop app:**
   ```powershell
   cd packages/desktop
   pnpm build
   pnpm generate:icons
   ```

3. **Create installer:**
   ```powershell
   pnpm package:win
   ```

## Installer Output

The installer will be created as:
- **Windows:** `packages/desktop/out/PulseCal SecureBand Setup x.x.x.exe`

## Installation

After building, the installer can be:
- Distributed via download link
- Copied to USB drive/external storage
- Shared via network drive

Users just need to:
1. Run the installer (.exe)
2. Follow the installation wizard
3. Launch from desktop shortcut or Start Menu

**Note:** The app requires PostgreSQL and Redis to be running for full functionality. These should be pre-installed on the target system.
