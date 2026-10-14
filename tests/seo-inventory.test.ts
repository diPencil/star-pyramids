import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/server/seo-manager', () => ({ readSeoState: vi.fn() }))
vi.mock('@/lib/server/record-seo', () => ({ listRecordSeo: vi.fn() }))
import { readSeoState } from '@/lib/server/seo-manager'
import { listRecordSeo } from '@/lib/server/record-seo'
import { initialRecordSeoState, emptyRecordSeoContent, type RecordSeoKind } from '@/lib/record-seo'
import { seoInventory } from '@/lib/server/seo-inventory'
import { initialPageState } from '@/lib/page-sections'
import { SEO_PAGES } from '@/lib/seo-manager'
beforeEach(() => {
  vi.mocked(readSeoState).mockResolvedValue(initialPageState())
  vi.mocked(listRecordSeo).mockResolvedValue([])
})
describe('actual route/source inventory without live data writes', () => {
  it('registers all static SEO consumers, excludes aliases/hidden tours/redirect offers and preserves unknown baselines', async () => {
    const entry = (kind: RecordSeoKind, slug: string, path: string, published = true) => ({ record: { kind, slug, name: 'Source', publicUrl: path, canonicalPaths: [path], published, sourceEditor: '/admin/trips' }, state: initialRecordSeoState() })
    vi.mocked(listRecordSeo).mockResolvedValue([entry('tour', 'public-tour', '/egypt-tours/public-tour'), entry('tour', 'hidden-tour', '/egypt-tours/hidden-tour', false), entry('offer', 'campaign', '/special-offers/campaign')])
    const rows = await seoInventory()
    expect(rows.filter(row => row.kind === 'cms')).toHaveLength(Object.keys(SEO_PAGES).length)
    expect(rows.some(row => row.route === '/egypt-tours/public-tour' && row.kind === 'business')).toBe(true)
    expect(rows.some(row => row.route === '/special-offers/campaign')).toBe(true)
    expect(rows.some(row => /old-tour|hidden-tour|linked-offer/.test(row.route))).toBe(false)
    expect(rows.find(row => row.route === '/rent-car/request')?.index).toBeNull()
    expect(rows.find(row => row.route === '/checkout')?.index).toBe(false)
  })
  it('does not fabricate empty collection totals on source failure', async () => {
    vi.mocked(listRecordSeo).mockRejectedValue(new Error('Unavailable'))
    await expect(seoInventory()).rejects.toThrow('Unavailable')
  })
  it('uses actual published record SEO in overview, never the saved private draft', async () => {
    const published = emptyRecordSeoContent(); published.text.en.title = 'Public title'; published.index = false
    const draft = emptyRecordSeoContent(); draft.text.en.title = 'PRIVATE DRAFT'
    vi.mocked(listRecordSeo).mockResolvedValue([{ record: { kind: 'blog', slug: 'story', name: 'Original story', publicUrl: '/blogs/story', canonicalPaths: ['/blogs/story'], published: true, sourceEditor: '/admin/blogs' }, state: { ...initialRecordSeoState(), published, draft } }])
    const rows = await seoInventory()
    expect(rows.find(row => row.route === '/blogs/story')).toMatchObject({ title: 'Public title', index: false, editor: '/admin/website-cms/seo/dynamic/blog/story' })
    expect(JSON.stringify(rows)).not.toContain('PRIVATE DRAFT')
  })
})
