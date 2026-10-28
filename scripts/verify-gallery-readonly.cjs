// Local SELECT-only verification. Never prints media URLs or customer content.
const { PrismaClient } = require('@prisma/client')
const { createHash } = require('node:crypto')
async function main() {
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw Error('Local database only.')
  const db = new PrismaClient()
  try {
    const rows = await db.$queryRaw`SELECT * FROM journey_gallery_items ORDER BY id`
    const assignments = await db.$queryRaw`SELECT * FROM journey_gallery_tours ORDER BY id`
    console.log(JSON.stringify({ items: rows.length, assignments: assignments.length, sha256: createHash('sha256').update(JSON.stringify({ rows, assignments })).digest('hex') }, null, 2))
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error('Local read-only gallery verification could not be completed.'); process.exitCode = 1 })
