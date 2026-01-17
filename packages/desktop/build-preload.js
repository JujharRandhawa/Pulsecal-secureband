/**
 * Build script to compile preload.ts to preload.js
 * This is run before Electron starts
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

try {
  console.log('Building preload script...');
  // Compile preload.ts to preload.js
  execSync(
    `npx tsc src/preload.ts --outDir dist --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --resolveJsonModule`,
    { cwd: __dirname, stdio: 'inherit' }
  );
  console.log('Preload script built successfully');
} catch (error) {
  console.error('Failed to build preload script:', error);
  process.exit(1);
}
