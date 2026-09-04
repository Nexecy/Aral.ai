/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === '1';

const nextConfig = {
  // Capacitor/Tauri still need a static export. Vercel must stay a normal
  // Next.js build so runtime routes like /session/<uuid>/ resolve.
  output: isVercel ? undefined : process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  transpilePackages: ['canvas-confetti'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
