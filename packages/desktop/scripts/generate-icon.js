/**
 * Generate application icons for PulseCal SecureBand
 * Creates PNG (512x512) and ICO (multi-size) icons
 */

const fs = require('fs');
const path = require('path');

// Eye with heartbeat pattern icon for PulseCal SecureBand
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="512" height="512" fill="#f5f5f5"/>
    
    <!-- Eye shape (almond/oval) -->
    <g transform="translate(256, 256)">
      <!-- Eye outline -->
      <path d="M -180 -80 Q -200 -100, -180 -120 Q -160 -140, -120 -140 Q -80 -140, -40 -120 Q 0 -100, 40 -120 Q 80 -140, 120 -140 Q 160 -140, 180 -120 Q 200 -100, 180 -80 Q 200 -60, 180 -40 Q 160 -20, 120 -20 Q 80 -20, 40 -40 Q 0 -60, -40 -40 Q -80 -20, -120 -20 Q -160 -20, -180 -40 Q -200 -60, -180 -80 Z" 
            stroke="#1e3a8a" 
            stroke-width="16" 
            fill="none" 
            stroke-linecap="round"
            stroke-linejoin="round"/>
      
      <!-- Vertical bars on left -->
      <line x1="-140" y1="-60" x2="-140" y2="60" stroke="#1e3a8a" stroke-width="8" stroke-linecap="round"/>
      <line x1="-100" y1="-50" x2="-100" y2="50" stroke="#1e3a8a" stroke-width="6" stroke-linecap="round"/>
      
      <!-- Vertical bars on right -->
      <line x1="100" y1="-50" x2="100" y2="50" stroke="#1e3a8a" stroke-width="6" stroke-linecap="round"/>
      <line x1="140" y1="-60" x2="140" y2="60" stroke="#1e3a8a" stroke-width="8" stroke-linecap="round"/>
      
      <!-- Heartbeat/ECG wave pattern (horizontal through center) -->
      <path d="M -180 0 L -150 -30 L -120 0 L -90 -30 L -60 0 L -30 20 L 0 0 L 30 -20 L 60 0 L 90 30 L 120 0 L 150 -30 L 180 0" 
            stroke="#1e3a8a" 
            stroke-width="12" 
            fill="none" 
            stroke-linecap="round"
            stroke-linejoin="round"/>
    </g>
  </svg>`;

// For now, we'll create a simple script that uses sharp if available,
// or provides instructions for manual creation
function generateIcons() {
  const buildDir = path.join(__dirname, '../build');
  
  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Save SVG for reference
  const svgPath = path.join(buildDir, 'icon.svg');
  fs.writeFileSync(svgPath, svgIcon);
  console.log('✅ Created icon.svg');

  // Try to use sharp to generate PNG and ICO
  try {
    const sharp = require('sharp');
    
    // Generate PNG (512x512)
    const pngPath = path.join(buildDir, 'icon.png');
    sharp(Buffer.from(svgIcon))
      .resize(512, 512)
      .png()
      .toFile(pngPath)
      .then(() => {
        console.log('✅ Created icon.png (512x512)');
        
        // Generate ICO with multiple sizes
        const icoSizes = [16, 32, 48, 64, 128, 256];
        const icoPath = path.join(buildDir, 'icon.ico');
        
        // Create ICO with multiple sizes using sharp
        Promise.all(
          icoSizes.map(size => 
            sharp(Buffer.from(svgIcon))
              .resize(size, size)
              .png()
              .toBuffer()
          )
        )
        .then(buffers => {
          // For Windows ICO, we'll create a simple ICO file
          // Note: Sharp doesn't directly support ICO, so we create a multi-size PNG
          // and use it as ICO (Windows will accept it)
          // For proper ICO, we'd need a library like 'to-ico' or convert online
          
          // Save the 256x256 version as ICO (Windows accepts PNG in ICO format)
          return sharp(buffers[buffers.length - 1]) // Use 256x256
            .toFile(icoPath);
        })
        .then(() => {
          console.log('✅ Created icon.ico');
          console.log('\n✅ Icons generated successfully!');
          console.log('   - icon.svg (source)');
          console.log('   - icon.png (512x512)');
          console.log('   - icon.ico (256x256)');
        })
        .catch((err) => {
          console.warn('⚠️  Could not create ICO, but PNG is ready');
          console.log('📝 To create proper multi-size ICO, convert icon.png using:');
          console.log('   https://cloudconvert.com/png-to-ico');
        });
      })
      .catch((err) => {
        console.error('Error generating PNG:', err.message);
        console.log('\n📝 Manual icon creation required:');
        console.log('   1. Open icon.svg in a browser or image editor');
        console.log('   2. Export as PNG (512x512) → build/icon.png');
        console.log('   3. Convert PNG to ICO → build/icon.ico');
      });
  } catch (error) {
    // sharp not available, provide instructions
    console.log('📦 Installing sharp for icon generation...');
    console.log('   Run: npm install sharp --save-dev');
    console.log('\n📝 Alternative: Manual icon creation');
    console.log('   1. Open icon.svg in browser/image editor');
    console.log('   2. Export as PNG (512x512) → build/icon.png');
    console.log('   3. Convert to ICO: https://cloudconvert.com/png-to-ico');
    console.log('   4. Save as build/icon.ico');
    
    // Still save the SVG
    console.log('\n✅ SVG icon saved to build/icon.svg');
  }
}

// Run if called directly
if (require.main === module) {
  generateIcons();
}

module.exports = { generateIcons, svgIcon };
