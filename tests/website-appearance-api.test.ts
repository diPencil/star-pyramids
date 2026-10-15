import { beforeEach, describe, expect, it, vi } from 'vitest'
const memory = vi.hoisted(() => ({ rows: new Map<string, string>(), authenticated: true, view: true, edit: true, origin: true, conflict: false, duplicate: false, revalidate: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: {
  findUnique: async ({ where }: { where: { key: string } }) => memory.rows.has(where.key) ? { value: memory.rows.get(where.key)! } : null,
  create: async ({ data }: { data: { key: string; value: string } }) => { if (memory.duplicate) throw { code: 'P2002' }; memory.rows.set(data.key, data.value); return data },
  updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => { if (memory.conflict || memory.rows.get(where.key) !== where.value) return { count: 0 }; memory.rows.set(where.key, data.value); return { count: 1 } },
} } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.authenticated ? { id: 'staff' } : null, hasPermission: (_user: unknown, permission: string) => permission === 'settings.edit' ? memory.edit : memory.view }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => memory.origin }))
vi.mock('next/cache', () => ({ revalidatePath: memory.revalidate }))
import { GET, PATCH } from '@/app/api/admin/website-cms/appearance/route'
import { APPEARANCE_KEY } from '@/lib/website-appearance'
import { readPublishedAppearance } from '@/lib/server/website-appearance'
const request = (body: unknown) => new Request('https://starpyramids.com/api/admin/website-cms/appearance', { method: 'PATCH', body: JSON.stringify(body) })
const save = (revision: number, content: unknown) => PATCH(request({ action: 'save-draft', revision, content }))
beforeEach(() => { memory.rows.clear(); memory.authenticated = true; memory.view = true; memory.edit = true; memory.origin = true; memory.conflict = false; memory.duplicate = false; memory.revalidate.mockReset() })

describe('appearance API with isolated in-memory persistence only', () => {
  it('saves drafts privately and publishes/restores without touching other CMS, SEO or promotional records', async () => {
    memory.rows.set('site.seoTitle', 'Original SEO'); memory.rows.set('site.promoText', 'Original announcement'); memory.rows.set('cms.page.homepage.v1', 'Original homepage')
    expect((await save(0, { primary: '#123456' })).status).toBe(200)
    expect(await readPublishedAppearance()).toEqual({}); expect(memory.revalidate).not.toHaveBeenCalled()
    expect((await PATCH(request({ action: 'publish', revision: 1 }))).status).toBe(200)
    expect(await readPublishedAppearance()).toEqual({ primary: '#123456' }); expect(memory.revalidate).toHaveBeenCalledWith('/', 'layout')
    await save(2, { primary: '#abcdef' }); await PATCH(request({ action: 'publish', revision: 3 }))
    expect((await PATCH(request({ action: 'restore', revision: 4 }))).status).toBe(200)
    expect(await readPublishedAppearance()).toEqual({ primary: '#123456' })
    expect(memory.rows.get('site.seoTitle')).toBe('Original SEO'); expect(memory.rows.get('site.promoText')).toBe('Original announcement'); expect(memory.rows.get('cms.page.homepage.v1')).toBe('Original homepage')
    expect(memory.rows.size).toBe(4)
  })
  it('rejects stale revisions, concurrent updates and first-create races', async () => {
    await save(0, {}); const before = memory.rows.get(APPEARANCE_KEY)
    expect((await save(0, { primary: '#000000' })).status).toBe(409)
    memory.conflict = true; expect((await save(1, {})).status).toBe(409)
    expect(memory.rows.get(APPEARANCE_KEY)).toBe(before)
    memory.rows.clear(); memory.duplicate = true; expect((await save(0, {})).status).toBe(409)
  })
  it('protects authentication, read permissions, mutation permissions and origin', async () => {
    memory.authenticated = false; expect((await GET()).status).toBe(401); expect((await save(0, {})).status).toBe(401)
    memory.authenticated = true; memory.view = false; expect((await GET()).status).toBe(403); expect((await save(0, {})).status).toBe(403)
    memory.view = true; memory.edit = false; const view = await GET(); expect(view.status).toBe(200); expect((await view.json()).canEdit).toBe(false); expect((await save(0, {})).status).toBe(403)
    memory.edit = true; memory.origin = false; expect((await save(0, {})).status).toBe(403); expect(memory.rows.size).toBe(0)
  })
  it.each([{ action: 'save-draft', revision: -1, content: {} }, { action: 'unknown', revision: 0 }, { action: 'save-draft', revision: 0, content: { font: 'https://bad.example' } }, { action: 'publish', revision: 0 }, { action: 'restore', revision: 0 }])('rejects invalid lifecycle data %j', async body => {
    expect((await PATCH(request(body))).status).toBe(400); expect(memory.rows.size).toBe(0)
  })
  it('bounds streaming request size', async () => {
    expect((await save(0, { primary: 'x'.repeat(17000) })).status).toBe(400); expect(memory.rows.size).toBe(0)
  })
  it('fails closed on corrupt stored state without overwriting it', async () => {
    memory.rows.set(APPEARANCE_KEY, 'broken')
    expect((await GET()).status).toBe(503); expect((await save(0, {})).status).toBe(503)
    expect(memory.rows.get(APPEARANCE_KEY)).toBe('broken'); expect(await readPublishedAppearance()).toEqual({})
  })
  it('returns private non-indexable state responses', async () => {
    const response = await GET(); expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })
})
