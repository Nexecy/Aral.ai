/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === '1';

const nextConfig = {
  // Capacitor/Tauri still need a static export. Vercel must stay a normal
  // Next.js build so runtime routes like /session/<uuid>/ resolve.
  output: isVercel ? undefined : process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  transpilePackages: ['lucide-react', 'framer-motion', 'canvas-confetti', 'clsx', 'tailwind-merge'],
};

export default nextConfig;
