import { describe, expect, it } from 'vitest'
import type { Tour } from '@/data/types'
import { selectHomepagePopular } from '@/lib/homepage-popular'
import { originalPageContent } from '@/lib/page-sections'
import { readRecommendationSession, RECOMMENDATION_SESSION_KEY } from '@/lib/homepage-recommendation-session'

const categories = ['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const
const rows = Array.from({ length: 12 }, (_, index) => ({
  slug: `tour-${index}`, title: `Tour ${index}`, category: categories[index % 4], status: 'published',
  location: 'Egypt', duration: '1 day', price: 1, image: '', summary: '',
})) as Tour[]
const section = () => originalPageContent().sections.find(item => item.id === 'popular')!

describe('homepage Recommended selection', () => {
  it('extends an existing six-card session to eight without changing its original choices', () => {
    const session = { seed: 73, slugs: rows.slice(0, 6).map(row => row.slug) }
    const result = selectHomepagePopular('All', section(), rows, rows, [], session)
    expect(result).toHaveLength(8)
    expect(result.slice(0, 6).map(row => row.slug)).toEqual(session.slugs)
    const stored = { seed: session.seed, slugs: result.map(row => row.slug) }
    expect(readRecommendationSession({ getItem: () => JSON.stringify(stored), setItem: () => {} }, () => 999)).toEqual(stored)
  })
  it('shows only eight distinct published records without mutating the pool', () => {
    const input = [...rows, rows[0], { ...rows[0], slug: 'draft', status: 'draft' }]
    const result = selectHomepagePopular('All', section(), input, input, input)
    expect(result).toHaveLength(8)
    expect(new Set(result.map(tour => tour.slug)).size).toBe(8)
    expect(result.every(tour => tour.status === 'published')).toBe(true)
    expect(input[0].slug).toBe('tour-0')
  })
  it.each(categories)('makes a new %s record eligible for new sessions', category => {
    const input = [...rows, { ...rows[0], slug: 'new-tour', category }]
    const chosen = new Set(Array.from({ length: 20 }, (_, seed) => selectHomepagePopular('All', section(), input, input, [], { seed, slugs: [] })).flat().map(row => row.slug))
    expect(chosen.has('new-tour')).toBe(true)
  })
  it.each(categories)('keeps the existing eight-card category selection for %s', category => {
    const input = Array.from({ length: 10 }, (_, index) => ({ ...rows[index], category }))
    expect(selectHomepagePopular(category, section(), input, input, []).map(tour => tour.slug)).toEqual(input.slice(0, 8).map(tour => tour.slug))
  })
  it('caps Recommended without imposing eight on a manual category selection', () => {
    const manual = section(); manual.selectionMode = 'selected'; manual.selection = rows.map(row => row.slug).reverse(); manual.limit = 0
    const oneType = rows.map(row => ({ ...row, category: 'one-day-tours' as const }))
    expect(selectHomepagePopular('All', manual, [], oneType, oneType).map(tour => tour.slug)).toEqual(manual.selection.slice(0, 8))
    expect(selectHomepagePopular('one-day-tours', manual, [], oneType, oneType)).toHaveLength(12)
  })
  it('honors smaller CMS limits and pools with fewer than eight records', () => {
    const limited = section(); limited.limit = 3
    expect(selectHomepagePopular('All', limited, rows, rows, [])).toHaveLength(3)
    expect(selectHomepagePopular('All', section(), rows.slice(0, 2), [], [])).toHaveLength(2)
    expect(selectHomepagePopular('All', section(), [], [], [])).toEqual([])
  })
  it('varies by session and is independent of API ordering', () => {
    const choose = (seed: number, input = rows) => selectHomepagePopular('All', section(), input, input, [], { seed, slugs: [] }).map(row => row.slug)
    expect(choose(1)).not.toEqual(choose(2))
    expect(choose(1, [...rows].reverse())).toEqual(choose(1))
  })
  it('keeps existing choices when new tours arrive and replaces unavailable choices with fresh database data', () => {
    const first = selectHomepagePopular('All', section(), rows, rows, [], { seed: 123, slugs: [] })
    const session = { seed: 123, slugs: first.map(row => row.slug) }
    const added = [...rows, { ...rows[0], slug: 'new-arrival' }]
    expect(selectHomepagePopular('All', section(), added, added, [], session).map(row => row.slug)).toEqual(session.slugs)
    const removed = session.slugs[0]
    const refreshed = added.map(row => ({ ...row, price: 99, status: row.slug === removed ? 'draft' : row.status }))
    const result = selectHomepagePopular('All', section(), refreshed, refreshed, [], session)
    expect(result).toHaveLength(8)
    expect(result.map(row => row.slug).slice(0, 7)).toEqual(session.slugs.slice(1))
    expect(result.some(row => row.slug === removed)).toBe(false)
    expect(result.every(row => row.price === 99)).toBe(true)
  })
  it('restores tab-session choices across reopening and safely handles broken storage', () => {
    const stored = { seed: 73, slugs: rows.slice(0, 8).map(row => row.slug) }
    const storage = { getItem: (key: string) => key === RECOMMENDATION_SESSION_KEY ? JSON.stringify(stored) : null, setItem: () => {} }
    expect(readRecommendationSession(storage, () => 999)).toEqual(stored)
    expect(readRecommendationSession({ ...storage, getItem: () => '{broken' }, () => 999)).toEqual({ seed: 999, slugs: [] })
    expect(readRecommendationSession({ ...storage, getItem: () => { throw Error('Blocked') } }, () => 999)).toEqual({ seed: 999, slugs: [] })
    expect(readRecommendationSession(undefined, () => 42)).toEqual({ seed: 42, slugs: [] })
  })
})
