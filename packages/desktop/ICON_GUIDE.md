# Application Icon Guide

## Required Icons

The desktop application requires icon files for different platforms:

### Windows
- **File:** `build/icon.ico`
- **Format:** ICO (Windows Icon)
- **Sizes:** 16x16, 32x32, 48x48, 256x256
- **Tool:** Use online converter or ImageMagick

### Linux
- **File:** `build/icon.png`
- **Format:** PNG
- **Size:** 512x512 pixels (recommended)
- **Tool:** Any image editor

## Creating Icons

### Option 1: Online Tools
1. Create a 512x512 PNG image with your logo
2. Use [CloudConvert](https://cloudconvert.com/png-to-ico) to convert PNG to ICO
3. Place `icon.ico` in `build/` directory
4. Copy the PNG as `icon.png` in `build/` directory

### Option 2: ImageMagick (Command Line)
```bash
# Convert PNG to ICO with multiple sizes
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Option 3: Using GIMP/Photoshop
1. Create 512x512 image
2. Export as PNG → `build/icon.png`
3. Export as ICO (Windows) → `build/icon.ico`

## Icon Design Guidelines

- **Size:** 512x512 pixels minimum
- **Format:** PNG with transparency
- **Style:** Professional, clean, recognizable
- **Colors:** Match brand colors
- **Text:** Avoid small text (won't be readable at small sizes)
- **Background:** Transparent or solid color

## Current Status

✅ **Icons have been generated!**

The following icon files are available:
- `build/icon.svg` - Source SVG file
- `build/icon.png` - 512x512 PNG (for Linux)
- `build/icon.ico` - 256x256 ICO (for Windows)

To regenerate icons, run:
```bash
pnpm generate:icons
```

## Testing Icons

After adding icons, test by running:
```bash
cd packages/desktop
pnpm dev
```

The icon should appear in:
- Window title bar
- Taskbar (Windows/Linux)
- Application menu
- Installer
