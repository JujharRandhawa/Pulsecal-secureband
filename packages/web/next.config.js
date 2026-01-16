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
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_AI_SERVICES_URL: process.env.NEXT_PUBLIC_AI_SERVICES_URL || 'http://localhost:8000',
  },
};

module.exports = nextConfig;
