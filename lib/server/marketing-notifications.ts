import 'server-only'
import { createHash } from 'node:crypto'
import { db } from './db'
import { attachCatalogueTranslations } from './catalogue-translations'
import { readJsonObject } from '../json-text'
import { isOfferActive, offerDeadline, offerHref } from '../special-offers'
import { marketingPlacements, readCampaign } from '../marketing-campaigns'
import { MARKETING_READ_TYPE, type MarketingNotification } from '../marketing-notifications'
import type { CatalogueTranslations } from '../catalogue-translations'

type OfferSource = { id: string; slug: string; title: string; copy: string; badge: string; content: string; isPublished: boolean; startsAt: Date | null; deadline: string | null; discountPercent: number | null; tourSlug: string | null; updatedAt: Date; translations?: CatalogueTranslations; tour: { slug: string; status: string } | null }
type TourSource = { id: string; slug: string; title: string; summary: string; status: string; deal: string | null; detail: string | null; dayDetail: string | null; category: string; updatedAt: Date }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
const date = (value: Date) => value.toISOString()

/** Derived from current published business records, never fabricated events or mass recipient writes. */
export function buildMarketingFeed(offers: readonly OfferSource[], tours: readonly TourSource[], now = Date.now()): MarketingNotification[] {
  const result: MarketingNotification[] = [], linked = new Set<string>()
  for (const offer of offers) {
    if (!isOfferActive(offer, now) || offer.tourSlug && (!offer.tour || offer.tour.status !== 'published')) continue
    if (!offer.tourSlug && !readCampaign(readJsonObject(offer.content).campaign).placements.some(value => marketingPlacements.includes(value))) continue
    if (offer.tourSlug) linked.add(offer.tourSlug)
    const message = [offer.badge, offer.copy].filter(Boolean).join(' · ')
    const localized: MarketingNotification['localized'] = {}
    for (const locale of ['es', 'it'] as const) {
      const text = offer.translations?.[locale]
      localized[locale] = { title: text?.title ?? offer.title, message: [text?.badge ?? offer.badge, text?.copy ?? offer.copy].filter(Boolean).join(' · ') }
    }
    const item = { type: 'offer_available' as const, title: offer.title, message, href: offerHref(offer),
      createdAt: date(offer.startsAt && offer.startsAt > offer.updatedAt ? offer.startsAt : offer.updatedAt),
      expiresAt: offer.deadline ? new Date(offerDeadline(offer.deadline)).toISOString() : null, localized, readAt: null }
    result.push({ ...item, id: `marketing:offer:${digest([offer.id, item.title, item.message, item.href, offer.discountPercent, offer.startsAt, item.expiresAt, localized])}` })
  }
  for (const tour of tours) {
    if (tour.status !== 'published' || linked.has(tour.slug)) continue
    const deal = readJsonObject(tour.deal)
    if (typeof deal.percent !== 'number' || !Number.isFinite(deal.percent) || deal.percent <= 0 || deal.percent >= 100 || deal.endsAt != null && typeof deal.endsAt !== 'string') continue
    const deadline = typeof deal.endsAt === 'string' && deal.endsAt ? deal.endsAt : null
    if (!isOfferActive({ deadline }, now)) continue
    const details = readJsonObject(tour.category === 'one-day-tours' ? tour.dayDetail : tour.detail)
    const texts = readJsonObject(details.translations)
    const localized: MarketingNotification['localized'] = {}
    for (const locale of ['es', 'it'] as const) {
      const text = readJsonObject(texts[locale])
      localized[locale] = { title: `${deal.percent}% — ${typeof text.title === 'string' && text.title || tour.title}`, message: typeof text.summary === 'string' && text.summary || tour.summary }
    }
    const item = { type: 'tour_offer_available' as const, title: `${deal.percent}% — ${tour.title}`, message: tour.summary, href: `/egypt-tours/${tour.slug}`, createdAt: date(tour.updatedAt),
      expiresAt: deadline ? new Date(offerDeadline(deadline)).toISOString() : null, localized, readAt: null }
    result.push({ ...item, id: `marketing:tour:${digest([tour.id, item.title, item.message, item.href, item.expiresAt, localized])}` })
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

export async function listMarketingNotifications(): Promise<MarketingNotification[]> {
  const [offers, tours] = await Promise.all([
    db.offer.findMany({ where: { isPublished: true }, select: { id: true, slug: true, title: true, copy: true, badge: true, content: true, isPublished: true, startsAt: true, deadline: true, discountPercent: true, tourSlug: true, updatedAt: true, tour: { select: { slug: true, status: true } } } }),
    db.tour.findMany({ where: { status: 'published', deal: { not: null } }, select: { id: true, slug: true, title: true, summary: true, status: true, deal: true, detail: true, dayDetail: true, category: true, updatedAt: true } }),
  ])
  return buildMarketingFeed(await attachCatalogueTranslations('offer', offers), tours)
}
const receiptId = (userId: string, id: string) => `marketing_read_${digest([userId, id])}`
export async function marketingForUser(userId: string, feed: MarketingNotification[]): Promise<MarketingNotification[]> {
  if (!feed.length) return []
  const rows = await db.notification.findMany({ where: { userId, type: MARKETING_READ_TYPE, id: { in: feed.map(item => receiptId(userId, item.id)) } }, select: { id: true, readAt: true } })
  const read = new Map(rows.map(row => [row.id, row.readAt?.toISOString() ?? null]))
  return feed.map(item => ({ ...item, readAt: read.get(receiptId(userId, item.id)) ?? null }))
}
export async function markMarketingRead(userId: string, feed: MarketingNotification[]) {
  for (const item of feed) await db.notification.upsert({ where: { id: receiptId(userId, item.id) },
    create: { id: receiptId(userId, item.id), userId, type: MARKETING_READ_TYPE, title: 'Offer read', message: item.id, href: item.href, readAt: new Date() },
    update: {},
  })
}
