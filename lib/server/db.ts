// Server-only Prisma client singleton.
// Survives Next.js dev hot-reload via globalThis so HMR never opens
// excessive DB connections. NEVER import from client components —
// this module (and all of lib/server) enforces `server-only`.
import 'server-only';

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
