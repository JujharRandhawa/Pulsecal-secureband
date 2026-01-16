#!/usr/bin/env node
/**
 * Port Verification Script
 * Verifies that all ports are correctly configured and available
 */

const net = require('net');

const PORTS = {
  web: 3000,
  api: 3001,
  aiServices: 8000,
  postgres: 5432,
  redis: 6379,
};

const PORT_NAMES = {
  3000: 'Web Dashboard (Next.js)',
  3001: 'API Server (NestJS)',
  8000: 'AI Services (FastAPI)',
  5432: 'PostgreSQL Database',
  6379: 'Redis Cache',
};

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => resolve({ available: true, port }));
      server.close();
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ available: false, port, error: 'Port already in use' });
      } else {
        resolve({ available: false, port, error: err.message });
      }
    });
  });
}

async function verifyAllPorts() {
  console.log('\n============================================================================');
  console.log('  PulseCal SecureBand - Port Verification');
  console.log('============================================================================\n');
  
  const results = [];
  
  for (const [service, port] of Object.entries(PORTS)) {
    const result = await checkPort(port);
    results.push(result);
    
    const status = result.available ? '✅ AVAILABLE' : '❌ IN USE';
    const name = PORT_NAMES[port] || `Service (${service})`;
    
    console.log(`${status} - Port ${port.toString().padEnd(5)} - ${name}`);
    
    if (!result.available) {
      console.log(`         ⚠️  ${result.error}`);
    }
  }
  
  console.log('\n============================================================================\n');
  
  const allAvailable = results.every(r => r.available);
  
  if (allAvailable) {
    console.log('✅ All ports are available and ready to use!\n');
    process.exit(0);
  } else {
    console.log('❌ Some ports are already in use.');
    console.log('   Please close the applications using these ports or change the port configuration.\n');
    process.exit(1);
  }
}

verifyAllPorts().catch((error) => {
  console.error('Error verifying ports:', error);
  process.exit(1);
});
