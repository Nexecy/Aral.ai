/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  transpilePackages: ['lucide-react', 'framer-motion', 'canvas-confetti', 'clsx', 'tailwind-merge'],
};

export default nextConfig;
