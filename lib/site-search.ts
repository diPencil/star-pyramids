import type { Blog, Destination, Event, Offer, Tour } from '@/data/types'
import { isTourPublished } from './tour-publish'
import { isOfferActive, offerHref } from './special-offers'

export type SearchSources = { tours: readonly Tour[]; destinations: readonly Destination[]; events: readonly Event[]; offers: readonly Offer[]; blogs: readonly Blog[] }
export type SearchResult = { type: 'Tour' | 'Destination' | 'Event' | 'Offer' | 'Blog'; slug: string; title: string; image: string; copy: string; href: string; keywords?: string }
export const searchHref = (query: string) => '/search?q=' + encodeURIComponent(query.trim().slice(0, 120))
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Only caller-supplied live records; never import the bundled demo catalogue. */
export function searchPublishedContent(sources: SearchSources, query: string, now = Date.now()): SearchResult[] {
  const results: SearchResult[] = [
    ...sources.tours.filter(isTourPublished).map(t => ({ type: 'Tour' as const, slug: t.slug, title: t.title, image: t.image, copy: t.summary, keywords: t.location, href: `/egypt-tours/${encodeURIComponent(t.slug)}` })),
    ...sources.destinations.filter(d => d.isPublished !== false && d.showInDestinations !== false).map(d => ({ type: 'Destination' as const, slug: d.slug, title: d.title, image: d.image, copy: d.copy, href: `/destinations/${encodeURIComponent(d.slug)}` })),
    ...sources.events.filter(e => e.isPublished !== false).map(e => ({ type: 'Event' as const, slug: e.slug, title: e.title, image: e.image, copy: e.copy, keywords: e.location, href: `/events/${encodeURIComponent(e.slug)}` })),
    ...sources.offers.filter(o => isOfferActive(o, now) && (!o.tourSlug || sources.tours.some(t => t.slug === o.tourSlug && isTourPublished(t)))).map(o => ({ type: 'Offer' as const, slug: o.slug, title: o.title, image: o.image, copy: o.copy, href: offerHref(o) })),
    ...sources.blogs.filter(b => b.isPublished !== false).map(b => ({ type: 'Blog' as const, slug: b.slug, title: b.title, image: b.image, copy: b.excerpt, keywords: b.category, href: `/blogs/${encodeURIComponent(b.slug)}` })),
  ]
  const terms = normalize(query.slice(0, 120)).split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  return results.filter(item => {
    const key = item.type + ':' + item.slug
    if (!item.slug || seen.has(key) || !terms.every(term => normalize(`${item.title} ${item.copy} ${item.keywords ?? ''}`).includes(term))) return false
    seen.add(key)
    return true
  })
}
