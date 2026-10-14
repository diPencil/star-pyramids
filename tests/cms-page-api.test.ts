import { beforeEach, describe, expect, it, vi } from 'vitest'
const memory = vi.hoisted(() => ({ rows: new Map<string, string>(), authenticated: true, allowed: true, origin: true, conflict: false, records: ['existing-tour'], invalidLink: false, revalidate: vi.fn() }))
vi.mock('@/lib/server/db', () => {
  const reference = { findMany: async ({ where }: { where: { slug?: { in: string[] } } }) => (where.slug?.in ?? memory.records).filter((slug) => memory.records.includes(slug)).map((slug) => ({ slug, title: slug })), findFirst: async () => memory.invalidLink ? null : { slug: 'existing-tour' } }
  return { db: { siteSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => memory.rows.has(where.key) ? { value: memory.rows.get(where.key)! } : null,
    findMany: async ({ where }: { where: { key: { in: string[] } } }) => [...memory.rows].filter(([key]) => where.key.in.includes(key)).map(([key, value]) => ({ key, value })),
    create: async ({ data }: { data: { key: string; value: string } }) => { if (memory.rows.has(data.key)) throw { code: 'P2002' }; memory.rows.set(data.key, data.value); return data },
    updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => { if (memory.conflict || memory.rows.get(where.key) !== where.value) return { count: 0 }; memory.rows.set(where.key, data.value); return { count: 1 } },
  }, tour: reference, destination: reference, blog: reference, offer: reference, event: reference } }
})
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.authenticated ? { id: 'isolated-staff' } : null, hasPermission: () => memory.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => memory.origin }))
vi.mock('next/cache', () => ({ revalidatePath: memory.revalidate }))
import { GET, PATCH } from '@/app/api/admin/website-cms/pages/[pageKey]/route'
import { GET as overviewGET } from '@/app/api/admin/website-cms/pages/route'
import { readPublishedPage, readPresentationStates } from '@/lib/server/page-sections'
import { TEMPLATE_PAGES, type TemplatePageId } from '@/lib/template-presentation'
import { originalPageContent } from '@/lib/page-sections'
const context = (pageKey = 'homepage') => ({ params: Promise.resolve({ pageKey }) })
const request = (body: unknown) => new Request('https://example.test', { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => { memory.rows.clear(); memory.authenticated = true; memory.allowed = true; memory.origin = true; memory.conflict = false; memory.invalidLink = false; memory.revalidate.mockReset() })
describe('actual CMS page handlers with in-memory database only', () => {
  it.each(Object.keys(TEMPLATE_PAGES) as TemplatePageId[])('publishes %s with isolated keys, stale-write protection and draft-free public delivery', async (id) => {
    const content = originalPageContent(id)
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), context(id))).status).toBe(200)
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context(id))).status).toBe(200)
    expect((await readPublishedPage(id)).content).toEqual(content)
    expect((await PATCH(request({ action: 'unpublish', revision: 1 }), context(id))).status).toBe(409)
    const edited = structuredClone(content)
    const editable = edited.sections.find(s => Object.keys(s.text.en).length > 0)!
    editable.text.en[Object.keys(editable.text.en)[0]] = 'PRIVATE NEXT DRAFT'
    await PATCH(request({ action: 'save-draft', revision: 2, content: edited }), context(id))
    expect(JSON.stringify(await readPresentationStates())).not.toContain('PRIVATE NEXT DRAFT')
    expect(memory.rows.has('cms.page.homepage.v1')).toBe(false)
  })
  it.each(['faq', 'privacy', 'terms', 'guide', 'accessible'] as const)('isolates %s persistence, authorization, publication and stale revisions', async (id) => {
    const content = originalPageContent(id)
    expect((await GET(new Request('https://example.test'), context(id))).status).toBe(200)
    expect(memory.rows.size).toBe(0)
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), context(id))).status).toBe(200)
    expect(memory.rows.has(`cms.page.${id}.v1`)).toBe(true)
    expect(memory.rows.has('cms.page.homepage.v1')).toBe(false)
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context(id))).status).toBe(200)
    expect((await readPublishedPage(id)).content).toEqual(content)
    expect((await PATCH(request({ action: 'restore', revision: 1 }), context(id))).status).toBe(409)
    const overview = await (await overviewGET()).json()
    expect(overview.pages.find((page: { key: string }) => page.key === id).hasPublication).toBe(true)
    memory.allowed = false
    expect((await PATCH(request({ action: 'restore', revision: 2 }), context(id))).status).toBe(403)
  })
  it('does not create records on reads or expose draft content in public responses', async () => {
    await GET(new Request('https://example.test'), context())
    expect(memory.rows.size).toBe(0)
    const content = originalPageContent(); content.sections[2].text.en.xmasT = 'Private field'
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), context())).status).toBe(200)
    expect(JSON.stringify(await readPublishedPage())).not.toContain('Private field')
    const overview = await (await overviewGET()).json()
    expect(overview.drafts).toBe(1); expect(overview.published).toBe(0)
    expect(JSON.stringify(overview)).not.toContain('Private field')
    expect(memory.revalidate).not.toHaveBeenCalled()
  })
  it('publishes atomically, rejects stale/concurrent writes and preserves unrelated hero records', async () => {
    memory.rows.set('cms.hero.homepage.v1', 'existing hero document')
    const content = originalPageContent(); content.sections[2].text.en.xmasT = 'Published field'; content.sections[2].selectionMode = 'selected'; content.sections[2].selection = ['existing-tour']
    await PATCH(request({ action: 'save-draft', revision: 0, content }), context())
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context())).status).toBe(200)
    expect((await readPublishedPage()).content?.sections[2].text.en.xmasT).toBe('Published field')
    expect(memory.revalidate).toHaveBeenCalledWith('/')
    expect((await PATCH(request({ action: 'unpublish', revision: 1 }), context())).status).toBe(409)
    memory.conflict = true
    expect((await PATCH(request({ action: 'unpublish', revision: 2 }), context())).status).toBe(409)
    expect(memory.rows.get('cms.hero.homepage.v1')).toBe('existing hero document')
  })
  it('rejects missing or unpublished selected records and dynamic CTA destinations before any publish write', async () => {
    const content = originalPageContent(); content.sections[2].selectionMode = 'selected'; content.sections[2].selection = ['missing-tour']
    await PATCH(request({ action: 'save-draft', revision: 0, content }), context())
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context())).status).toBe(400)
    expect((await readPublishedPage()).content?.sections[2].selectionMode).toBe('automatic')
    content.sections[2].selection = []; content.sections[2].href = '/blogs/missing-article'; memory.invalidLink = true
    await PATCH(request({ action: 'save-draft', revision: 1, content }), context())
    expect((await PATCH(request({ action: 'publish', revision: 2 }), context())).status).toBe(400)
  })
  it('enforces authentication, permissions, CSRF, request shape and allowlisted page identity', async () => {
    memory.authenticated = false
    expect((await GET(new Request('https://example.test'), context())).status).toBe(401)
    expect((await PATCH(request({}), context())).status).toBe(401)
    memory.authenticated = true; memory.allowed = false
    expect((await overviewGET()).status).toBe(403)
    expect((await PATCH(request({}), context())).status).toBe(403)
    memory.allowed = true; memory.origin = false
    expect((await PATCH(request({}), context())).status).toBe(403)
    memory.origin = true
    expect((await PATCH(request({ action: 'delete', revision: 0 }), context())).status).toBe(400)
    expect((await PATCH(request({}), context('__proto__'))).status).toBe(404)
    expect(memory.rows.size).toBe(0)
  })
  it('caps streamed bodies before parsing or writing and excludes invalid publications from real counts', async () => {
    const response = await PATCH(new Request('https://example.test', { method: 'PATCH', body: 'x'.repeat(512001) }), context())
    expect(response.status).toBe(413)
    expect(memory.rows.size).toBe(0)
    memory.rows.set('cms.hero.homepage.v1', JSON.stringify({ version: 1, mode: 'published', revision: 1, published: null }))
    expect((await (await overviewGET()).json()).published).toBe(0)
    await PATCH(request({ action: 'save-draft', revision: 0, content: originalPageContent() }), context())
    expect((await (await overviewGET()).json()).drafts).toBe(0)
  })
  it('disables a dynamic link after its business record becomes unpublished without restoring a default CTA', async () => {
    const content = originalPageContent(); content.sections[2].href = '/blogs/existing-tour'
    await PATCH(request({ action: 'save-draft', revision: 0, content }), context())
    await PATCH(request({ action: 'publish', revision: 1 }), context())
    memory.records = []
    expect((await readPublishedPage()).content?.sections[2].href).toBe('')
    memory.records = ['existing-tour']
  })
})
