// Run: node --conditions=react-server --import tsx scripts/verify-special-offers.mjs
// Every test write is rolled back. Existing offers and tours are never updated.
import assert from 'node:assert/strict'
process.loadEnvFile('.env')
const { db } = await import('../lib/server/db.ts')
const { linkedOfferFields, applyLinkedOfferDeals } = await import('../lib/server/special-offers.ts')
const { isOfferActive } = await import('../lib/special-offers.ts')
const { findTourBySlug } = await import('../lib/server/tours.ts')
const { getBookingTotal } = await import('../data/tours.ts')
const marker = new Error('ROLLBACK_SPECIAL_OFFERS_QA')
const originalFindMany = db.offer.findMany
let passed = 0
try {
  const before = await db.offer.findMany({ orderBy: { slug: 'asc' } })
  const tour = await db.tour.findFirst({ where: { specialOffer: null, status: 'published' } })
  assert.ok(tour, 'No unlinked published tour available for rollback-only verification')
  try {
    await db.$transaction(async tx => {
      db.offer.findMany = (...args) => tx.offer.findMany(...args)
      const fields = await linkedOfferFields(tx, { tourSlug: tour.slug, discountPercent: 20, deadline: '2099-01-01' })
      const row = await tx.offer.create({ data: { slug: `rollback-offer-${Date.now()}`, title: 'Rollback-only offer verification', badge: 'SAVE 20%', copy: 'Never committed.', image: tour.image, content: '{}', ...fields } })
      assert.equal((await tx.offer.findUnique({ where: { slug: row.slug } })).tourSlug, tour.slug); passed++
      assert.equal(row.price, Math.round(Number(tour.price) * .8 * 100) / 100); passed++
      assert.equal(await tx.offer.count({ where: { tourSlug: tour.slug } }), 1); passed++
      await assert.rejects(tx.offer.create({ data: { slug: `${row.slug}-duplicate`, title: 'Never committed duplicate', badge: 'SAVE', copy: 'Never committed.', image: tour.image, content: '{}', ...fields } }), error => error.code === 'P2002'); passed++
      await assert.rejects(linkedOfferFields(tx, { tourSlug: tour.slug, discountPercent: 150, deadline: '2099-01-01' }), /between 1 and 90/); passed++
      await assert.rejects(linkedOfferFields(tx, { tourSlug: tour.slug, discountPercent: 20, startsAt: '2099-02-01', deadline: '2099-01-01' }), /end date must follow/); passed++
      const resolved = await findTourBySlug(tour.slug)
      assert.equal(resolved.deal.percent, 20); passed++
      await tx.offer.update({ where: { slug: row.slug }, data: { discountPercent: 25 } })
      assert.equal((await findTourBySlug(tour.slug)).deal.percent, 25); passed++
      await tx.offer.update({ where: { slug: row.slug }, data: { discountPercent: 20 } })
      assert.deepEqual(resolved.manualDeal, JSON.parse(tour.deal || 'null') ?? undefined); passed++
      const pricing = getBookingTotal(resolved, 2, 0, 0)
      assert.ok(pricing.originalTotal > 0); assert.equal(pricing.adult, Math.round((pricing.originalTotal / 2) * .8 * 100) / 100); passed++
      await tx.offer.update({ where: { slug: row.slug }, data: { isPublished: false } })
      assert.equal(isOfferActive(await tx.offer.findUnique({ where: { slug: row.slug } })), false); passed++
      assert.deepEqual((await applyLinkedOfferDeals([tour]))[0].deal, JSON.parse(tour.deal || 'null')); passed++
      await tx.offer.update({ where: { slug: row.slug }, data: { isPublished: true, deadline: '2000-01-01' } })
      assert.equal(isOfferActive(await tx.offer.findUnique({ where: { slug: row.slug } })), false); passed++
      await tx.offer.delete({ where: { slug: row.slug } })
      assert.equal(await tx.offer.count({ where: { tourSlug: tour.slug } }), 0); passed++
      assert.equal((await tx.tour.findUnique({ where: { slug: tour.slug } })).deal, tour.deal); passed++
      throw marker
    }, { timeout: 20000 })
  } catch (error) { if (error !== marker) throw error }
  finally { db.offer.findMany = originalFindMany }
  assert.deepEqual(await db.offer.findMany({ orderBy: { slug: 'asc' } }), before); passed++
  console.log(JSON.stringify({ passed, database: 'MySQL', transaction: 'rolled back', existingRecordsPreserved: true }))
} finally { db.offer.findMany = originalFindMany; await db.$disconnect() }
