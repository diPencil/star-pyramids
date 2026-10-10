import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const store = vi.hoisted(() => ({ rows: new Map<string, string>(), conflict: false }))
vi.mock('@/lib/server/db', () => ({ db: { siteSetting: {
  findUnique: vi.fn(async ({ where }: { where: { key: string } }) => store.rows.has(where.key) ? { key: where.key, value: store.rows.get(where.key) } : null),
  create: vi.fn(async ({ data }: { data: { key: string; value: string } }) => { if (store.rows.has(data.key)) throw Error('Duplicate'); store.rows.set(data.key, data.value); return data }),
  updateMany: vi.fn(async ({ where, data }: { where: { key: string; value: string }; data: { value: string } }) => { if (store.conflict || store.rows.get(where.key) !== where.value) return { count: 0 }; store.rows.set(where.key, data.value); return { count: 1 } }),
} } }))
import { getReviewIntegrations, saveReviewIntegration, loadReviewFeed } from '@/lib/server/review-integrations'
const config = { enabled: false, resourceId: 'ChIJexample', profileUrl: '', widgetId: '' }
beforeEach(() => { store.rows.clear(); store.conflict = false; vi.stubEnv('REVIEW_INTEGRATIONS_KEY', 'a'.repeat(64)) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('Review settings persistence contract', () => {
  it('saves and reloads real settings values while redacting encrypted keys', async () => {
    await saveReviewIntegration('google', config, 'secret-one', false)
    expect(store.rows.get('reviews.integration.google')).not.toContain('secret-one')
    const rows = await getReviewIntegrations(); expect(rows[0].secretConfigured).toBe(true); expect(rows[0].resourceId).toBe(config.resourceId)
    expect(JSON.stringify(rows)).not.toContain('credential'); expect(JSON.stringify(rows)).not.toContain('secret-one')
  })
  it('keeps an omitted key, replaces explicitly, then removes explicitly', async () => {
    await saveReviewIntegration('google', config, 'secret-one', false); const first = JSON.parse(store.rows.get('reviews.integration.google')!).credential
    await saveReviewIntegration('google', { ...config, enabled: true }, '', false); expect(JSON.parse(store.rows.get('reviews.integration.google')!).credential).toBe(first)
    await saveReviewIntegration('google', config, 'secret-two', false); expect(JSON.parse(store.rows.get('reviews.integration.google')!).credential).not.toBe(first)
    await saveReviewIntegration('google', config, '', true); expect((await getReviewIntegrations())[0].secretConfigured).toBe(false)
  })
  it('does not restore an old secret when a concurrent save wins', async () => {
    await saveReviewIntegration('google', config, 'secret-one', false); const previous = store.rows.get('reviews.integration.google')
    store.conflict = true; await expect(saveReviewIntegration('google', config, '', true)).rejects.toThrow('Configuration changed')
    expect(store.rows.get('reviews.integration.google')).toBe(previous)
  })
  it('never calls a provider when display is disabled', async () => {
    await saveReviewIntegration('google', config, 'secret-one', false); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect((await loadReviewFeed('google')).state).toBe('not_connected'); expect(fetch).not.toHaveBeenCalled()
  })
  it('does not modify other settings or existing owner data', async () => {
    store.rows.set('site.name', 'Existing company'); await saveReviewIntegration('google', config, '', false); expect(store.rows.get('site.name')).toBe('Existing company'); expect(store.rows.size).toBe(2)
  })
})
