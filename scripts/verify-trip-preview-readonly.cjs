// SELECT-only local Tour/Offer fingerprint. No titles, URLs or prices are printed.
const { PrismaClient } = require('@prisma/client')
const { createHash } = require('node:crypto')
async function main() {
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw Error('Local database only.')
  const db = new PrismaClient()
  try {
    const tours = await db.$queryRaw`SELECT * FROM tours ORDER BY slug`
    const offers = await db.$queryRaw`SELECT * FROM offers ORDER BY slug`
    console.log(JSON.stringify({ tours: tours.length, offers: offers.length, sha256: createHash('sha256').update(JSON.stringify({ tours, offers })).digest('hex') }, null, 2))
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error('Read-only local trip verification could not be completed.'); process.exitCode = 1 })
