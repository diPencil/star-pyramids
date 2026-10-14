import { beforeEach, describe, expect, it, vi } from 'vitest'
const memory = vi.hoisted(() => ({ auth: true, permissions: new Set<string>(), origin: true, entries: new Map<string, unknown>(), conflict: false, revalidate: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: new Proxy({}, { get: () => { throw new Error('API regressions must never access the real database') } }) }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.auth ? { id: 'staff' } : null, hasPermission: (_user: unknown, key: string) => memory.permissions.has(key) }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => memory.origin }))
vi.mock('next/cache', () => ({ revalidatePath: memory.revalidate }))
vi.mock('@/lib/server/tours', () => ({ findTourBySlug: async () => ({ slug: 'egypt', title: 'Egypt', summary: 'A real source description', category: 'one-day-tours', price: 0 }) }))
vi.mock('@/lib/server/blogs', () => ({ findBlogBySlug: async () => ({ slug: 'egypt', title: 'Egypt', excerpt: 'An actual article.', category: 'Travel' }) }))
vi.mock('@/lib/server/record-seo', () => ({
  listRecordSeo: async () => [...memory.entries.values()],
  readRecordSeo: async (kind: string, slug: string) => { const row = memory.entries.get(kind + ':' + slug); if (!row) throw Object.assign(new Error('Missing'), { status: 404 }); return row },
  changeRecordSeo: async (kind: string, slug: string, action: 'save-draft' | 'publish' | 'restore', revision: number, content?: unknown) => {
    const row = memory.entries.get(kind + ':' + slug) as Entry
    if (memory.conflict || revision !== row.state.revision) throw new HeroConflictError('Reload before saving.')
    const result = { record: row.record, state: transitionRecordSeo(row.state, action, content) }; memory.entries.set(kind + ':' + slug, result); return result
  },
}))
import { HeroConflictError } from '@/lib/server/website-heroes'
import { initialRecordSeoState, transitionRecordSeo, emptyRecordSeoContent, type RecordSeoKind, type RecordSeoDescriptor, type RecordSeoState } from '@/lib/record-seo'
import { GET, PATCH } from '@/app/api/admin/website-cms/seo/records/[kind]/[slug]/route'
import { GET as list } from '@/app/api/admin/website-cms/seo/records/route'
import { GET as preview } from '@/app/api/admin/website-cms/seo/records/[kind]/[slug]/preview/route'
type Entry = { record: RecordSeoDescriptor; state: RecordSeoState }
const paths = { tour: '/egypt-tours/', blog: '/blogs/', destination: '/destinations/', event: '/events/', offer: '/special-offers/', category: '/egypt-tours/multi-days-tours/' }
const modules = { tour: 'tours', blog: 'blogs', destination: 'destinations', event: 'events', offer: 'offers', category: 'categories' }
const kinds = Object.keys(paths) as RecordSeoKind[]
const context = (kind = 'tour', slug = 'egypt') => ({ params: Promise.resolve({ kind, slug }) })
const request = (body: unknown) => new Request('https://starpyramids.com/api/admin/website-cms/seo/records/tour/egypt', { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => {
  memory.entries.clear(); memory.auth = true; memory.origin = true; memory.conflict = false; memory.revalidate.mockReset()
  memory.permissions = new Set(['settings.view', 'settings.edit', ...Object.values(modules).flatMap(module => [module + '.view', module + '.edit'])])
  for (const kind of kinds) memory.entries.set(kind + ':egypt', { record: { kind, slug: 'egypt', name: 'Egypt', description: 'A real source description', published: true, publicUrl: paths[kind] + 'egypt', canonicalPaths: [paths[kind] + 'egypt'], sourceEditor: '/admin/' + modules[kind] }, state: initialRecordSeoState() })
})
describe('record SEO handlers: isolated mock persistence only', () => {
  it.each(kinds)('supports %s save/publish/preview/restore without publishing business content', async kind => {
    const seo = emptyRecordSeoContent(); seo.text.es.title = 'SEO privado'; seo.structuredData = false
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: seo }), context(kind))).status).toBe(200)
    const key = kind + ':egypt'; expect((memory.entries.get(key) as Entry).state.published).toBeNull()
    expect(memory.revalidate).not.toHaveBeenCalled()
    const result = await preview(new Request('https://starpyramids.com/preview?locale=es'), context(kind))
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    expect(result.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await result.json()).toMatchObject({ metadata: { title: { absolute: 'SEO privado' } }, structuredData: null })
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context(kind))).status).toBe(200)
    expect(memory.revalidate).toHaveBeenCalledWith(paths[kind] + 'egypt')
    expect(memory.revalidate).toHaveBeenCalledWith('/sitemap.xml')
    expect((await PATCH(request({ action: 'restore', revision: 2 }), context(kind))).status).toBe(200)
    expect((memory.entries.get(key) as Entry).state.published).toBeNull()
  })
  it('requires original module permission in addition to CMS permission', async () => {
    memory.permissions.delete('tours.edit')
    expect((await GET(request({}), context())).status).toBe(200)
    expect(await (await GET(request({}), context())).json()).toMatchObject({ canEdit: false })
    expect((await PATCH(request({}), context())).status).toBe(403)
    memory.permissions.delete('tours.view')
    expect((await GET(request({}), context())).status).toBe(403)
    expect((await preview(new Request('https://starpyramids.com/preview'), context())).status).toBe(403)
    const body = await (await list()).json()
    expect(body.records.some((row: Entry) => row.record.kind === 'tour')).toBe(false)
  })
  it('rejects unauthenticated, cross-origin, forged, oversized and stale requests', async () => {
    memory.auth = false; expect((await GET(request({}), context())).status).toBe(401)
    memory.auth = true; memory.origin = false; expect((await PATCH(request({}), context())).status).toBe(403)
    memory.origin = true
    expect((await PATCH(request({ data: 'x'.repeat(21000) }), context())).status).toBe(400)
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: { ...emptyRecordSeoContent(), structuredData: '<script>' } }), context())).status).toBe(400)
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: { ...emptyRecordSeoContent(), canonical: '/nonexistent' } }), context())).status).toBe(400)
    expect((await GET(request({}), context('car'))).status).toBe(404)
    expect((await GET(request({}), context('tour', '../escape'))).status).toBe(404)
    memory.conflict = true
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: emptyRecordSeoContent() }), context())).status).toBe(409)
  })
  it('validates publish-time canonical availability, not just saved draft input', async () => {
    const seo = { ...emptyRecordSeoContent(), canonical: '/blogs/egypt' }
    await PATCH(request({ action: 'save-draft', revision: 0, content: seo }), context())
    memory.entries.delete('blog:egypt')
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context())).status).toBe(400)
    expect((memory.entries.get('tour:egypt') as Entry).state.published).toBeNull()
  })
  it('uses the same built-in source schemas as actual tour/blog/category pages', async () => {
    for (const [kind, type] of [['tour', 'TouristTrip'], ['blog', 'BlogPosting'], ['category', 'CollectionPage']] as const) {
      const response = await preview(new Request('https://starpyramids.com/preview?locale=en'), context(kind))
      expect(response.status).toBe(200)
      expect((await response.json()).structuredData).toMatchObject({ '@type': type })
    }
  })
})
