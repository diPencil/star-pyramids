/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phase 1A: static export REMOVED. API routes, server sessions and
  // Prisma database access require the Node.js server runtime
  // (`next start`). See BACKEND_SETUP.md for deployment implications.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
