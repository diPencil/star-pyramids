import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialRecordSeoState, transitionRecordSeo, validateRecordSeoContent } from '@/lib/record-seo'
import { fetchSavedRecordSeoPreview, filterSeoRecords, type SeoRecordResponse } from '@/components/admin/seo-record-editor'

vi.mock('@/components/admin/seo-manager', () => ({ SeoEditor: () => null }))
vi.mock('@/components/admin/admin-ui', () => ({}))
vi.mock('@/components/admin/admin-pagination', () => ({}))
vi.mock('@/components/shared-select', () => ({}))

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const editor = read('components/admin/seo-manager.tsx')
const records = read('components/admin/seo-record-editor.tsx')
const route = read('app/admin/website-cms/seo/dynamic/[kind]/[slug]/page.tsx')
const content = { text: { en: { title: 'Egypt', description: 'Explore Egypt' }, es: { title: 'Egipto', description: 'Explora Egipto' }, it: { title: 'Egitto', description: 'Esplora Egitto' } }, image: '', structuredData: false }

afterEach(() => vi.unstubAllGlobals())

describe('private saved preview request', () => {
  it('reads only the requested saved locale with caching disabled', async () => {
    const snapshot = { metadata: { title: '<script>escaped text</script>' }, structuredData: { '@type': 'TouristTrip' }, locale: 'es', publicUrl: '/egypt-tours/giza' }
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot })
    vi.stubGlobal('fetch', request)
    expect(await fetchSavedRecordSeoPreview('/api/admin/website-cms/seo/records/tour/giza', 'es')).toEqual(snapshot)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/website-cms/seo/records/tour/giza/preview?locale=es', { cache: 'no-store' })
  })
  it('accepts a disabled structured-data snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ metadata: {}, structuredData: null, locale: 'it', publicUrl: null }) }))
    expect((await fetchSavedRecordSeoPreview('/record', 'it')).structuredData).toBeNull()
  })
  it.each([401, 403, 503])('surfaces HTTP %s without displaying a success result', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(fetchSavedRecordSeoPreview('/record', 'en')).rejects.toThrow(status === 503 ? 'Could not validate' : 'do not have access')
  })
  it('rejects a response for the wrong locale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ metadata: {}, structuredData: null, locale: 'es', publicUrl: null }) }))
    await expect(fetchSavedRecordSeoPreview('/record', 'en')).rejects.toThrow('Invalid saved preview')
  })
  it('requires an explicit clean-state action and renders results as escaped React text', () => {
    expect(editor).toContain('disabled={dirty || busy || conflict || !recordData}')
    expect(editor).toContain('onClick={() => void validateSavedPreview()}')
    expect(editor).toContain('<pre>{JSON.stringify(savedPreview.metadata, null, 2)}</pre>')
    expect(editor).toContain('<pre>{JSON.stringify(savedPreview.structuredData, null, 2)}</pre>')
    expect(editor).toContain('setSavedPreview(null); setPreviewError')
  })
})

describe('record SEO UI contracts', () => {
  it('searches actual names and URLs while combining kind and publication filters', () => {
    const make = (kind: 'tour' | 'blog', slug: string, name: string, published: boolean, publicUrl: string | null): Omit<SeoRecordResponse, 'canEdit'> => ({ record: { kind, slug, name, published, publicUrl, canonicalPaths: [], sourceEditor: '/admin/trips' }, state: initialRecordSeoState() })
    const rows = [make('tour', 'giza', 'Giza Day Visit', true, '/egypt-tours/giza'), make('blog', 'guide', 'Egypt Guide', false, null)]
    expect(filterSeoRecords(rows, ' DAY ', 'tour', 'published')).toEqual([rows[0]])
    expect(filterSeoRecords(rows, '/egypt-tours', 'all', 'all')).toEqual([rows[0]])
    expect(filterSeoRecords(rows, '', 'all', 'hidden')).toEqual([rows[1]])
    expect(filterSeoRecords(rows, 'guide', 'tour', 'all')).toEqual([])
    expect(filterSeoRecords([], '', 'all', 'all')).toEqual([])
  })
  it('uses dedicated record APIs and the shared validated editor', () => {
    expect(editor).toContain("'/api/admin/website-cms/seo/records/'")
    expect(editor).toContain('validateRecordSeoContent(content)')
    expect(editor).toContain('revision: recordData?.state.revision')
    expect(records).toContain('/api/admin/website-cms/seo/records')
    expect(records).toContain('record.name')
    expect(records).toContain('record.publicUrl')
    expect(records).toContain("record.published ? 'Published' : 'Hidden'")
    expect(route).toContain("['tour', 'blog', 'destination', 'event', 'offer', 'category']")
    expect(route).toContain('notFound()')
  })
  it('protects edits, disallows duplicate writes and publishing unsaved changes', () => {
    expect(editor).toContain('protectEnquiryNavigation(window')
    expect(editor).toContain('Discard unsaved SEO edits?')
    expect(editor).toContain('disabled || lock.current')
    expect(editor).toContain('disabled || dirty || !draft')
    expect(editor).toContain('response.status === 409')
    expect(editor).toContain('setCanEdit(next.canEdit)')
    expect(editor).toContain('busy || !canEdit || conflict')
  })
  it('keeps previews private and distinguishes real diagnostics from Google analytics', () => {
    expect(editor).toContain('Private local draft illustration')
    expect(editor).toContain('Enable automatic structured data')
    expect(editor).toContain('Social preview')
    expect(records).toContain('Cars are not eligible')
    expect(records).toContain('/api/admin/website-cms/seo/diagnostics')
    expect(records).toContain('data.counts.indexable')
    expect(records).toContain('row.message')
    expect(records).toContain('Google Search Console is not connected')
  })
  it('saves the structured-data toggle without making drafts public', () => {
    const draft = transitionRecordSeo(initialRecordSeoState(), 'save-draft', validateRecordSeoContent(content))
    expect(draft.draft?.structuredData).toBe(false)
    expect(draft.published).toBeNull()
    const published = transitionRecordSeo(draft, 'publish')
    expect(published.published?.structuredData).toBe(false)
    expect(transitionRecordSeo(published, 'restore')).toMatchObject({ draft: null, published: null })
  })
  it('rejects arbitrary schema and malformed robots or structured-data options', () => {
    expect(() => validateRecordSeoContent({ ...content, structuredData: '{}' })).toThrow()
    expect(() => validateRecordSeoContent({ ...content, schema: {} })).toThrow()
    expect(() => validateRecordSeoContent({ ...content, index: 'false' })).toThrow()
  })
})
