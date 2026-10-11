import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, emailNormalized: true, username: true, status: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());