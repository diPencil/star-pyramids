// Read-only local evidence; never prints review text, names or email addresses.
const { PrismaClient } = require('@prisma/client')
const { createHash } = require('node:crypto')
async function main() {
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw Error('Only a local database may be inspected.')
  const db = new PrismaClient()
  try {
    const rows = await db.review.findMany({ orderBy: { id: 'asc' } })
    const statuses = Object.fromEntries(['PENDING', 'PUBLISHED', 'REJECTED'].map(status => [status, rows.filter(row => row.status === status).length]))
    console.log(JSON.stringify({ count: rows.length, website: rows.filter(row => row.tourSlug === '@website').length, trips: rows.filter(row => row.tourSlug !== '@website').length, statuses, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') }, null, 2))
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error('Read-only local review verification could not be completed.'); process.exitCode = 1 })
