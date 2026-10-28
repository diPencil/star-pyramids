import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Destination } from '@/data/types'

const m = vi.hoisted(() => ({ permissions: [] as string[], loading: false, error: null as string | null, fetch: vi.fn() }))
const destination: Destination = { slug: 'cairo', title: 'Cairo', image: '/cairo.jpg', copy: 'Published but excluded from the listing', isPublished: true, showInDestinations: false, showInOneDayTours: true, detail: { heroImage: '/hero.jpg', heroAlt: 'Cairo', eyebrow: '', intro: '', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [], tourSlugs: [] } }
vi.mock('@/lib/use-current-user', () => ({ useCurrentUser: () => ({ user: { id: 'staff', roles: ['STAFF'], permissions: m.permissions } }) }))
vi.mock('@/lib/catalogue-client', () => ({
  useDbDestinationsStatus: () => ({ data: m.loading || m.error ? null : [destination], loading: m.loading, error: m.error, retry: vi.fn(), refresh: vi.fn() }),
  invalidateCatalogueCache: vi.fn(), dbSlugify: (value: string) => value.toLowerCase(),
}))
vi.mock('@/components/admin/admin-shell', () => ({ PageHead: ({ title, actions }: { title: string; actions: React.ReactNode }) => createElement('header', null, title, actions) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import DestinationsPage from '@/app/admin/destinations/page'
import DestinationEditorPage from '@/app/admin/destinations/new/page'

beforeEach(() => { m.permissions = ['destinations.view']; m.loading = false; m.error = null; m.fetch.mockClear(); vi.stubGlobal('fetch', m.fetch) })
afterEach(() => vi.unstubAllGlobals())

describe('Destination admin rendered permissions and state', () => {
  it('keeps excluded destinations visible to admin and links their canonical detail route', () => {
    const html = renderToStaticMarkup(createElement(DestinationsPage))
    expect(html).toContain('Cairo')
    expect(html).toContain('href="/destinations/cairo"')
    expect(html).not.toContain('/egypt-tours/one-day-tours/cairo')
    expect(html).toContain('Filter by publication')
    expect(html).toContain('Filter by listing visibility')
    expect(m.fetch).not.toHaveBeenCalled()
  })
  it('hides create/edit/delete operations from a read-only staff member', () => {
    const html = renderToStaticMarkup(createElement(DestinationsPage))
    expect(html).not.toContain('New destination')
    expect(html).not.toContain('Edit Cairo')
    expect(html).not.toContain('Delete Cairo')
  })
  it('exposes only permitted mutation actions', () => {
    m.permissions = ['destinations.view', 'destinations.create', 'destinations.edit', 'destinations.delete']
    const html = renderToStaticMarkup(createElement(DestinationsPage))
    expect(html).toContain('New destination')
    expect(html).toContain('Edit Cairo')
    expect(html).toContain('Delete Cairo')
  })
  it('renders loading and retry/error states without bootstrap records', () => {
    m.loading = true
    expect(renderToStaticMarkup(createElement(DestinationsPage))).toContain('Loading destinations')
    m.loading = false; m.error = 'Catalogue unavailable'
    const html = renderToStaticMarkup(createElement(DestinationsPage))
    expect(html).toContain('Catalogue unavailable')
    expect(html).toContain('Retry')
    expect(html).not.toContain('href="/destinations/cairo"')
  })
  it('keeps the editor save disabled until its record and permissions load', () => {
    const html = renderToStaticMarkup(createElement(DestinationEditorPage))
    expect(html).toContain('Loading destination')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/)
    expect(m.fetch).not.toHaveBeenCalled()
  })
})
