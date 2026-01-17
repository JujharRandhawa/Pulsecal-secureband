/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pulsecal/shared'],
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Disable dev indicators
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  // Optimize for production
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  // Output configuration for Electron
  output: process.env.ELECTRON_BUILD ? 'standalone' : undefined,
  // Disable image optimization in Electron (not needed)
  images: {
    unoptimized: process.env.ELECTRON_BUILD === 'true',
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_AI_SERVICES_URL: process.env.NEXT_PUBLIC_AI_SERVICES_URL || 'http://localhost:8000',
    // Electron flag
    ELECTRON_BUILD: process.env.ELECTRON_BUILD || 'false',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
