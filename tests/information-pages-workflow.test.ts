import { beforeEach, describe, expect, it, vi } from 'vitest'

const memory = vi.hoisted(() => ({ rows: new Map<string, string>() }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: {
  findUnique: async ({ where }: { where: { key: string } }) => memory.rows.has(where.key) ? { value: memory.rows.get(where.key)! } : null,
  create: async ({ data }: { data: { key: string; value: string } }) => { memory.rows.set(data.key, data.value); return data },
  updateMany: async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => {
    if (memory.rows.get(where.key) !== where.value) return { count: 0 }
    memory.rows.set(where.key, data.value)
    return { count: 1 }
  },
} } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => ({ id: 'test-staff' }), hasPermission: () => true }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => true }))

import { GET, PATCH } from '@/app/api/admin/website-cms/editorial-heroes/[id]/route'
import { readFaqHeroState } from '@/lib/server/faq-hero'
import { publicEditorialHero } from '@/lib/editorial-hero-definitions'
import { INFORMATION_PAGE_IDS, originalInformationPage } from '@/lib/information-pages'

const request = (body: object) => new Request('https://example.test', { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => memory.rows.clear())
describe('information page API and real persistence service with an in-memory Prisma boundary', () => {
  it.each(INFORMATION_PAGE_IDS)('%s saves, publishes, rejects stale edits and explicitly restores page sections', async (id) => {
    const context = { params: Promise.resolve({ id }) }
    const original = originalInformationPage(id)
    await readFaqHeroState(id)
    expect(memory.rows.size).toBe(0)
    const content = originalInformationPage(id)
    content.sections = [content.sections![0]]
    content.sections[0].text.es.description = 'Contenido publicado para el cliente.'
    expect((await PATCH(request({ action: 'save-draft', revision: 0, content }), context)).status).toBe(200)
    expect(publicEditorialHero(id, await readFaqHeroState(id)).content).toEqual(original)
    expect((await PATCH(request({ action: 'publish', revision: 1 }), context)).status).toBe(200)
    expect(publicEditorialHero(id, await readFaqHeroState(id)).content).toEqual(content)
    content.sections = []
    expect((await PATCH(request({ action: 'save-draft', revision: 2, content }), context)).status).toBe(200)
    expect(publicEditorialHero(id, await readFaqHeroState(id)).content?.sections).toHaveLength(1)
    expect((await PATCH(request({ action: 'publish', revision: 2 }), context)).status).toBe(409)
    expect((await PATCH(request({ action: 'publish', revision: 3 }), context)).status).toBe(200)
    expect(publicEditorialHero(id, await readFaqHeroState(id)).content?.sections).toEqual([])
    expect((await PATCH(request({ action: 'restore', revision: 4 }), context)).status).toBe(200)
    const result = await (await GET(new Request('https://example.test'), context)).json()
    expect(result.state.published).toEqual(original)
    expect([...memory.rows.keys()]).toEqual([`cms.hero.${id}.v1`])
  })
})
