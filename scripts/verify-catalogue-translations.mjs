// Run: node --conditions=react-server --import tsx scripts/verify-catalogue-translations.mjs
// Every test transaction is deliberately rolled back. No canonical records are written.
import assert from 'node:assert/strict'
process.loadEnvFile('.env')
const { db } = await import('../lib/server/db.ts')
const { saveWithCatalogueTranslations, deleteWithCatalogueTranslations } = await import('../lib/server/catalogue-translations.ts')
const runTransaction = db.$transaction.bind(db)
const originalTransaction = db.$transaction
const marker = new Error('verification rollback')
const kinds = ['destination', 'category', 'event', 'offer', 'blog', 'car']
const prefix = `translation-check-${Date.now()}`
let passed = 0

try {
  const before = await Promise.all([db.destination.count(), db.multiDayCategory.count(), db.event.count(), db.offer.count(), db.blog.count(), db.car.count()])
  for (const kind of kinds) {
    const field = kind === 'category' ? 'name' : 'title'
    const expected = { es: { [field]: 'Texto verificado' } }
    for (const scenario of ['create', 'rename', 'preserve', 'delete', 'fresh-create', 'failure']) {
      const slug = `${prefix}-${kind}`
      const nextSlug = scenario === 'rename' ? `${slug}-next` : slug
      db.$transaction = async (callback) => runTransaction(async (tx) => {
        if (scenario !== 'create') {
          await tx.$executeRaw`INSERT INTO catalogue_translations (entityType, slug, payload) VALUES (${kind}, ${slug}, ${JSON.stringify(expected)})`
        }
        try {
          await callback(tx)
        } catch (error) {
          if (scenario === 'failure') {
            assert.equal(error.message, 'mutation failed')
            passed++
            throw marker
          }
          throw error
        }
        const rows = await tx.$queryRaw`SELECT slug, payload FROM catalogue_translations WHERE entityType = ${kind} AND slug IN (${slug}, ${nextSlug})`
        if (scenario === 'delete') assert.equal(rows.length, 0)
        else {
          assert.equal(rows.length, 1)
          assert.equal(rows[0].slug, nextSlug)
          assert.deepEqual(JSON.parse(rows[0].payload), scenario === 'fresh-create' ? {} : expected)
        }
        passed++
        throw marker
      })
      try {
        if (scenario === 'delete') await deleteWithCatalogueTranslations(kind, slug, async () => ({ slug }))
        else await saveWithCatalogueTranslations(kind,
          ['preserve', 'fresh-create', 'failure'].includes(scenario) ? undefined : expected,
          ['rename', 'preserve', 'failure'].includes(scenario) ? slug : undefined,
          async () => { if (scenario === 'failure') throw new Error('mutation failed'); return { slug: nextSlug } },
        )
        assert.fail('Test transaction did not roll back')
      } catch (error) {
        assert.equal(error, marker)
      }
    }
  }
  const after = await Promise.all([db.destination.count(), db.multiDayCategory.count(), db.event.count(), db.offer.count(), db.blog.count(), db.car.count()])
  assert.deepEqual(after, before)
  const leftovers = await db.$queryRaw`SELECT COUNT(*) AS total FROM catalogue_translations WHERE slug LIKE ${`${prefix}%`}`
  assert.equal(Number(leftovers[0].total), 0)
  console.log(JSON.stringify({ passed, database: 'MySQL', transactions: 'rolled back', canonicalCountsUnchanged: true, leftoverTestRows: 0 }))
} finally {
  db.$transaction = originalTransaction
  await db.$disconnect()
}
