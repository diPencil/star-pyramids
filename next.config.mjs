/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phase 1A: static export REMOVED. API routes, server sessions and
  // Prisma database access require the Node.js server runtime
  // (`next start`). See BACKEND_SETUP.md for deployment implications.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable Next.js image optimization with modern formats
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Experimental: optimize package imports
  experimental: {
    optimizePackageImports: ['lucide-react', '@base-ui/react'],
  },
}

export default nextConfig
