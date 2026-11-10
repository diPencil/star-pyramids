export type OfferWindow = { isPublished?: boolean; startsAt?: string | Date | null; deadline?: string | null }
export function offerDeadline(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = Date.parse(`${value}T00:00:00.000Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time + 86400000 - 1 : NaN
  }
  return Date.parse(value)
}
export function isOfferActive(offer: OfferWindow, now = Date.now()): boolean {
  const start = offer.startsAt ? new Date(offer.startsAt).getTime() : -Infinity
  const end = offer.deadline ? offerDeadline(offer.deadline) : Infinity
  return offer.isPublished !== false && start <= now && end >= now
}
export function offerHref(offer: { slug: string; tourSlug?: string | null }): string {
  return offer.tourSlug ? `/egypt-tours/${offer.tourSlug}` : `/special-offers/${offer.slug}`
}
