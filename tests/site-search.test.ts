import { describe, expect, it } from 'vitest'
import { nextSearchOption, searchHref, searchPublishedContent, type SearchSources } from '@/lib/site-search'
import type { Blog, Destination, Event, Offer, Tour } from '@/data/types'

const sources = (overrides: Partial<SearchSources> = {}): SearchSources => ({ tours: [], destinations: [], events: [], offers: [], blogs: [], ...overrides })
const tour = (overrides: Partial<Tour> = {}) => ({ slug: 'cairo', title: 'Cairo pyramids', image: '/tour.jpg', summary: 'Private tour', location: 'Giza', status: 'published', ...overrides } as Tour)
const destination = (overrides: Partial<Destination> = {}) => ({ slug: 'luxor', title: 'Lúxor', image: '/destination.jpg', copy: 'Ancient temples', isPublished: true, ...overrides } as Destination)
const event = (overrides: Partial<Event> = {}) => ({ slug: 'festival', title: 'Cairo festival', image: '/event.jpg', copy: 'Live music', location: 'Cairo', isPublished: true, ...overrides } as Event)
const offer = (overrides: Partial<Offer> = {}) => ({ slug: 'discount', title: 'Cairo savings', image: '/offer.jpg', copy: 'Private transfer', isPublished: true, ...overrides } as Offer)
const blog = (overrides: Partial<Blog> = {}) => ({ slug: 'guide', title: 'Cairo guide', image: '/blog.jpg', excerpt: 'Markets and food', category: 'Tips', isPublished: true, ...overrides } as Blog)

describe('live public search contracts', () => {
  it('matches partial destination names and ranks title prefixes before incidental copy', () => {
    const rows = searchPublishedContent(sources({ tours: [tour({ title: 'Private transfer', summary: 'From Cairo' })], destinations: [destination({ title: 'Cairo', slug: 'cairo' })], blogs: [blog({ title: 'Cairo guide' })] }), 'cair')
    expect(rows.map(row => row.type)).toEqual(['Destination', 'Blog', 'Tour'])
    expect(rows[0].href).toBe('/destinations/cairo')
    expect(rows[0].href).not.toBe(rows[0].image)
  })
  it('moves through suggestions by keyboard, wraps safely and handles an empty list', () => {
    expect(nextSearchOption(-1, 'ArrowDown', 3)).toBe(0)
    expect(nextSearchOption(2, 'ArrowDown', 3)).toBe(0)
    expect(nextSearchOption(-1, 'ArrowUp', 3)).toBe(2)
    expect(nextSearchOption(1, 'ArrowUp', 3)).toBe(0)
    expect(nextSearchOption(0, 'ArrowDown', 0)).toBe(-1)
  })
  it('contains no demo content when the current database collections are empty', () => {
    expect(searchPublishedContent(sources(), '')).toEqual([])
    expect(searchPublishedContent(sources(), 'Cairo')).toEqual([])
  })
  it('searches all five live sources and uses their canonical links', () => {
    const rows = searchPublishedContent(sources({ tours: [tour()], destinations: [destination()], events: [event()], offers: [offer()], blogs: [blog()] }), '')
    expect(rows.map(row => row.href)).toEqual(['/egypt-tours/cairo', '/destinations/luxor', '/events/festival', '/special-offers/discount', '/blogs/guide'])
    expect(searchPublishedContent(sources({ destinations: [destination()] }), ' LUXOR temples ')).toHaveLength(1)
    expect(searchPublishedContent(sources({ tours: [tour()] }), 'giza')).toHaveLength(1)
  })
  it('excludes unpublished and hidden content even for staff API responses', () => {
    expect(searchPublishedContent(sources({ tours: [tour({ status: 'draft' })], destinations: [destination({ isPublished: false }), destination({ showInDestinations: false })], events: [event({ isPublished: false })], offers: [offer({ isPublished: false })], blogs: [blog({ isPublished: false })] }), '')).toEqual([])
  })
  it('drops deleted records on the next authoritative collection and deduplicates by type/slug', () => {
    expect(searchPublishedContent(sources({ tours: [tour(), tour()] }), 'cairo')).toHaveLength(1)
    expect(searchPublishedContent(sources({ tours: [] }), 'cairo')).toEqual([])
    expect(searchPublishedContent(sources({ tours: [tour()], events: [event({ slug: 'cairo' })] }), 'cairo')).toHaveLength(2)
  })
  it('honors offer scheduling and links tour offers only to a published tour', () => {
    const now = Date.parse('2026-10-28T12:00:00Z')
    const linked = offer({ tourSlug: 'cairo' })
    expect(searchPublishedContent(sources({ offers: [linked] }), '', now)).toEqual([])
    const rows = searchPublishedContent(sources({ tours: [tour()], offers: [linked, offer({ slug: 'expired', deadline: '2026-10-27' }), offer({ slug: 'future', startsAt: '2026-10-29' })] }), '', now)
    expect(rows.filter(row => row.type === 'Offer')).toMatchObject([{ href: '/egypt-tours/cairo', slug: 'discount' }])
  })
  it('matches localized text and requires all search words', () => {
    const rows = sources({ blogs: [blog({ title: 'Guía de Egipto', excerpt: 'Viajes privados' })] })
    expect(searchPublishedContent(rows, 'GUIA privados')).toHaveLength(1)
    expect(searchPublishedContent(rows, 'guia unknown')).toEqual([])
  })
  it('encodes header submissions and applies the same 120-character limit on mobile and desktop', () => {
    expect(searchHref('  Cairo & Giza  ')).toBe('/search?q=Cairo%20%26%20Giza')
    expect(searchHref('a'.repeat(150))).toBe('/search?q=' + 'a'.repeat(120))
  })
})
