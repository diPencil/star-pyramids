import { beforeEach, describe, expect, it, vi } from 'vitest'
const memory = vi.hoisted(() => ({ rows: new Map<string, string>(), auth: true, allowed: true, origin: true, conflict: false, revalidate: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: {
  findUnique: async ({ where }: { where: { key: string } }) => memory.rows.has(where.key) ? { value: memory.rows.get(where.key)! } : null,
  create: async ({ data }: { data: { key: string; value: string } }) => { memory.rows.set(data.key, data.value); return data },
  updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => { if (memory.conflict || memory.rows.get(where.key) !== where.value) return { count: 0 }; memory.rows.set(where.key, data.value); return { count: 1 } },
} } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.auth ? { id: 'staff' } : null, hasPermission: () => memory.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => memory.origin }))
vi.mock('next/cache', () => ({ revalidatePath: memory.revalidate }))
import { GET, PATCH } from '@/app/api/admin/website-cms/seo/[pageKey]/route'
import { originalPageContent, publicPageContent } from '@/lib/page-sections'
import { SEO_PAGES, currentSeo, originalSeoPage, type SeoPageId } from '@/lib/seo-manager'
const context = { params: Promise.resolve({ pageKey: 'about' }) }
const request = (body: unknown) => new Request('https://starpyramids.com/api/admin/website-cms/seo/about', { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => { memory.rows.clear(); memory.auth = true; memory.allowed = true; memory.origin = true; memory.conflict = false; memory.revalidate.mockReset() })
describe('SEO API with exclusively in-memory persistence', () => {
  it.each(Object.keys(SEO_PAGES) as SeoPageId[])('supports independent %s lifecycle using its existing authoritative page key', async id => {
    const ctx = { params: Promise.resolve({ pageKey: id }) }
    const content = originalSeoPage(id).seo
    content.text.en.title = 'SEO ' + id
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), ctx)).status).toBe(200)
    const draftState = (await (await GET(request({}), ctx)).json()).state
    expect(currentSeo(draftState, id).text.en.title).toBe('')
    expect((await PATCH(request({ action: 'publish', revision: 1 }), ctx)).status).toBe(200)
    const publishedState = (await (await GET(request({}), ctx)).json()).state
    expect(currentSeo(publishedState, id).text.en.title).toBe('SEO ' + id)
    expect([...memory.rows.keys()]).toEqual(['cms.page.' + id + '.v1'])
    expect((await PATCH(request({ action: 'restore', revision: 2 }), ctx)).status).toBe(200)
    const restored = (await (await GET(request({}), ctx)).json()).state
    expect(currentSeo(restored, id).text.en.title).toBe('')
  })
  it('saves, publishes, rejects stale revisions and invalidates only on public changes', async () => {
    const content = originalPageContent('about').seo; content.text.en.title = 'Published SEO'
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), context)).status).toBe(200)
    expect(memory.revalidate).not.toHaveBeenCalled()
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context)).status).toBe(200)
    expect(memory.revalidate).toHaveBeenCalledWith('/about')
    expect(memory.revalidate).toHaveBeenCalledWith('/sitemap.xml')
    const state = (await (await GET(request({}), context)).json()).state
    expect(publicPageContent(state, 'about').content?.seo.text.en.title).toBe('Published SEO')
    expect((await PATCH(request({ action: 'restore', revision: 1 }), context)).status).toBe(409)
  })
  it('handles a genuine compare-and-swap conflict without lost updates', async () => {
    const content = originalPageContent('about').seo
    await PATCH(request({ action: 'save-draft', revision: 0, content }), context)
    const before = memory.rows.get('cms.page.about.v1')
    memory.conflict = true
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context)).status).toBe(409)
    expect(memory.rows.get('cms.page.about.v1')).toBe(before)
  })
  it('rejects unauthorized, cross-origin, oversized, unknown-page and unsafe requests', async () => {
    memory.auth = false; expect((await GET(request({}), context)).status).toBe(401)
    memory.auth = true; memory.allowed = false; expect((await PATCH(request({}), context)).status).toBe(403)
    memory.allowed = true; memory.origin = false; expect((await PATCH(request({}), context)).status).toBe(403)
    memory.origin = true
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: { ...originalPageContent('about').seo, canonical: '/not-a-real-page' } }), context)).status).toBe(400)
    expect((await PATCH(request({ large: 'x'.repeat(17000) }), context)).status).toBe(400)
    expect((await GET(request({}), { params: Promise.resolve({ pageKey: 'shared' }) })).status).toBe(404)
    expect(memory.rows.size).toBe(0)
  })
})
