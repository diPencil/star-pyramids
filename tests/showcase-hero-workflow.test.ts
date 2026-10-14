import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = vi.hoisted(() => ({ rows: new Map<string, string>() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: {
  findUnique: async ({ where }: { where: { key: string } }) => memory.rows.has(where.key) ? { value: memory.rows.get(where.key)! } : null,
  create: async ({ data }: { data: { key: string; value: string } }) => {
    if (memory.rows.has(data.key)) throw { code: 'P2002' }
    memory.rows.set(data.key, data.value)
    return data
  },
  updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => {
    if (memory.rows.get(where.key) !== where.value) return { count: 0 }
    memory.rows.set(where.key, data.value)
    return { count: 1 }
  },
} } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => ({ id: 'test-staff' }), hasPermission: () => true }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => true }))

import { GET, PATCH } from '@/app/api/admin/website-cms/showcase-heroes/[id]/route'
import { readPublicShowcase } from '@/lib/server/showcase-heroes'
import { SHOWCASE_HERO_IDS, originalShowcaseHero, type ShowcaseHeroId } from '@/lib/showcase-heroes'

const context = (id: ShowcaseHeroId) => ({ params: Promise.resolve({ id }) })
const request = (body: object) => new Request('https://example.test/api/admin/website-cms/showcase-heroes', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => memory.rows.clear())

describe('real API and persistence workflow with an in-memory database boundary', () => {
  it.each(SHOWCASE_HERO_IDS)('%s preserves publication through draft edits and explicitly restores originals', async (id) => {
    expect(await readPublicShowcase(id)).toEqual({ hidden: false, content: null })
    expect(memory.rows.size).toBe(0)
    const draft = originalShowcaseHero(id)
    draft.text.en.title = 'First published heading'
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content: draft }), context(id))).status).toBe(200)
    expect(await readPublicShowcase(id)).toEqual({ hidden: false, content: null })
    const saved = await (await GET(new Request('https://example.test'), context(id))).json()
    expect(saved.state.draft.text.en.title).toBe('First published heading')
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context(id))).status).toBe(200)
    expect((await readPublicShowcase(id)).content?.text.en.title).toBe('First published heading')

    draft.text.en.title = 'Private next revision'
    expect((await PATCH(request({ action: 'save-draft', revision: 2, content: draft }), context(id))).status).toBe(200)
    expect(JSON.stringify(await readPublicShowcase(id))).not.toContain('Private next revision')
    expect((await PATCH(request({ action: 'publish', revision: 2 }), context(id))).status).toBe(409)
    expect((await readPublicShowcase(id)).content?.text.en.title).toBe('First published heading')
    expect((await PATCH(request({ action: 'unpublish', revision: 3 }), context(id))).status).toBe(200)
    expect(await readPublicShowcase(id)).toEqual({ hidden: true, content: null })
    expect((await PATCH(request({ action: 'save-draft', revision: 4, content: draft }), context(id))).status).toBe(200)
    expect((await readPublicShowcase(id)).hidden).toBe(true)
    expect((await PATCH(request({ action: 'restore', revision: 5 }), context(id))).status).toBe(200)
    expect(await readPublicShowcase(id)).toEqual({ hidden: false, content: null })
    expect((await (await GET(new Request('https://example.test'), context(id))).json()).state.draft).toEqual(originalShowcaseHero(id))
    expect(memory.rows.size).toBe(1)
  })
})
