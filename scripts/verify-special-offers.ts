// Local verification: all test records live inside a transaction that always rolls back.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

async function main() {
  process.loadEnvFile('.env')
  const { db } = await import('../lib/server/db')
  const { campaignContent, linkedOfferFields, presentOffer, offerTourSelect } = await import('../lib/server/special-offers')
  const { readCampaign, placedOffers } = await import('../lib/marketing-campaigns')
  const { toOffer } = await import('../lib/server/offers')
  const { toTour } = await import('../lib/server/tours')
  const { encodeTourJson } = await import('../lib/tour-json')
  const { writeJsonText, readJsonObject } = await import('../lib/json-text')
  const { getDealPrice } = await import('../data/tours')
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await Promise.all([
    db.offer.findMany({ orderBy: { slug: 'asc' } }), db.tour.findMany({ orderBy: { slug: 'asc' } }),
    db.$queryRaw`SELECT * FROM catalogue_translations ORDER BY entityType, slug`,
  ]))).digest('hex')
  const before = await fingerprint()
  const rollback = new Error('Verification rollback')
  try {
    await db.$transaction(async tx => {
      const suffix = Date.now().toString(36)
      const tour = await tx.tour.create({ data: encodeTourJson({ slug: `verify-offer-tour-${suffix}`, title: 'Verification only', aliases: [`verify-alias-${suffix}`], category: 'one-day-tours', location: 'Cairo', price: 125.5, duration: '1 day', image: '/verify.jpg', summary: 'Verification', gallery: ['/verify.jpg'], galleryCaptions: [], categorySlugs: [], journeyVideos: [], photoCredits: [], detail: { travelerPrices: [{ travelers: 2, adultPrice: 125.5 }] }, status: 'published' }) })
      const linked = await linkedOfferFields(tx, { tourSlug: tour.slug, discountPercent: 15, deadline: '2099-12-31' })
      const saved = await tx.offer.create({ data: { slug: `verify-linked-${suffix}`, title: 'Linked verification', badge: 'SAVE 15%', copy: 'Verification', content: '{}', ...linked, image: linked.image ?? '' } })
      const projected = presentOffer((await tx.offer.findUniqueOrThrow({ where: { slug: saved.slug }, include: { tour: { select: offerTourSelect } } })))
      assert.equal(projected.price, 106.68)
      const domainTour = toTour({ ...tour, deal: { percent: 15, endsAt: '2099-12-31' } })
      assert.equal(getDealPrice(domainTour), 106.68)
      assert.equal(domainTour.detail?.travelerPrices?.[0].adultPrice, 125.5)
      const campaign = { ...readCampaign(undefined), body: 'Stored body', terms: 'Stored terms', ctaLabel: 'Plan', ctaHref: '/make-your-trip', priceLabel: 'From', placements: ['offers', 'home', 'trips-sidebar', 'blog-sidebar'] }
      const content = campaignContent({ campaign }, { gallery: ['/one.jpg'], highlights: ['One'], retained: true })
      const row = await tx.offer.create({ data: { slug: `verify-campaign-${suffix}`, title: 'Campaign verification', image: '/verify.jpg', badge: 'Family', copy: 'Verification', content: writeJsonText(content), price: 125.5 } })
      assert.deepEqual(readJsonObject(row.content).campaign, campaign)
      for (const placement of ['offers', 'home', 'trips-sidebar', 'blog-sidebar'] as const) assert.equal(placedOffers([toOffer(row)], placement).length, 1)
      const hidden = await tx.offer.update({ where: { slug: row.slug }, data: { isPublished: false, content: writeJsonText(campaignContent({ isPublished: false }, content)) } })
      assert.equal(placedOffers([toOffer(hidden)], 'offers').length, 0)
      assert.equal(readJsonObject(hidden.content).retained, true)
      await tx.offer.delete({ where: { slug: saved.slug } })
      assert.equal((await tx.tour.findUniqueOrThrow({ where: { slug: tour.slug } })).deal, tour.deal)
      throw rollback
    }, { timeout: 15000 })
  } catch (error) { if (error !== rollback) throw error }
  assert.equal(await fingerprint(), before, 'Owner catalogue changed during verification')
  console.log('PASS: linked pricing, decoded booking details, campaign persistence, all placements, visibility and delete isolation; transaction rolled back; owner catalogue fingerprint unchanged.')
  await db.$disconnect()
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
