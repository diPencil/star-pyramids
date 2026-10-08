// Server-only Prisma client singleton.
// Survives Next.js dev hot-reload via globalThis so HMR never opens
// excessive DB connections. NEVER import from client components —
// this module (and all of lib/server) enforces `server-only`.
import 'server-only';

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// A schema/client regeneration can add delegates while dev HMR retains an old
// singleton. Replace that client rather than serving empty framework 500s.
const cachedClient = globalForPrisma.prisma;
const currentClient = cachedClient?.websiteEnquiry && cachedClient?.enquiryAttempt;
if (cachedClient && !currentClient) void cachedClient.$disconnect().catch(() => undefined);
export const db: PrismaClient =
  currentClient ? cachedClient! : new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
