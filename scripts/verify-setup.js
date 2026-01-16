#!/usr/bin/env node

/**
 * Verification script to check monorepo setup
 */

const fs = require('fs');
const path = require('path');

const checks = [
  {
    name: 'pnpm-workspace.yaml exists',
    check: () => fs.existsSync('pnpm-workspace.yaml'),
  },
  {
    name: 'Root package.json exists',
    check: () => fs.existsSync('package.json'),
  },
  {
    name: 'Shared package exists',
    check: () => fs.existsSync('packages/shared/package.json'),
  },
  {
    name: 'Web package exists',
    check: () => fs.existsSync('packages/web/package.json'),
  },
  {
    name: 'API package exists',
    check: () => fs.existsSync('packages/api/package.json'),
  },
  {
    name: 'AI services package exists',
    check: () => fs.existsSync('packages/ai-services/pyproject.toml'),
  },
  {
    name: 'Docker compose exists',
    check: () => fs.existsSync('docker-compose.yml'),
  },
  {
    name: 'TypeScript config exists',
    check: () => fs.existsSync('tsconfig.json'),
  },
  {
    name: 'ESLint config exists',
    check: () => fs.existsSync('.eslintrc.json'),
  },
  {
    name: 'Prettier config exists',
    check: () => fs.existsSync('.prettierrc.json'),
  },
];

console.log('🔍 Verifying PulseCal SecureBand monorepo setup...\n');

let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  if (check()) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✨ All checks passed! Monorepo structure is valid.');
}
