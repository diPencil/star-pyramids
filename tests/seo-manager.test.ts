import { describe, expect, it } from 'vitest'
import { initialPageState, originalPageContent, publicPageContent, transitionPageContent } from '@/lib/page-sections'
import { currentSeo, isSeoPage, transitionSeo } from '@/lib/seo-manager'
import { seoMetadata, validateSeoContent } from '@/lib/seo-content'

const seo = () => ({ ...originalPageContent('about').seo, text: { en: { title: 'Egypt journeys', description: 'Explore Egypt.' }, es: { title: 'Viajes a Egipto', description: 'Explora Egipto.' }, it: { title: 'Viaggi in Egitto', description: 'Esplora Egitto.' } } })
describe('SEO publication shares the existing page owner without publishing its draft', () => {
  it('keeps presentation drafts private on first SEO publication', () => {
    const content = originalPageContent('about')
    content.sections[1].text.en[Object.keys(content.sections[1].text.en)[0]] = 'PRIVATE BODY'
    const before = transitionPageContent(initialPageState(), 'save-draft', content, 'about')
    const draft = transitionSeo(before, 'about', 'save-draft', seo())
    expect(publicPageContent(draft, 'about').content?.seo.text.en.title).toBe('')
    const published = transitionSeo(draft, 'about', 'publish')
    expect(published.mode).toBe('original')
    expect(published.draft).toEqual(before.draft)
    expect(JSON.stringify(publicPageContent(published, 'about'))).not.toContain('PRIVATE BODY')
    expect(publicPageContent(published, 'about').content?.seo.text.es.title).toBe('Viajes a Egipto')
  })
  it('preserves the published body and independent SEO on subsequent page publication', () => {
    let state = transitionPageContent(initialPageState(), 'save-draft', originalPageContent('about'), 'about')
    state = transitionPageContent(state, 'publish', undefined, 'about')
    const body = structuredClone(state.published!.sections)
    state = transitionSeo(state, 'about', 'save-draft', seo())
    state = transitionSeo(state, 'about', 'publish')
    expect(state.published!.sections).toEqual(body)
    state = transitionPageContent(state, 'publish', undefined, 'about')
    expect(state.published!.seo.text.en.title).toBe('Egypt journeys')
    state = transitionPageContent(state, 'restore', undefined, 'about')
    expect(currentSeo(state, 'about').text.en.title).toBe('Egypt journeys')
  })
  it('restores SEO without discarding body drafts or changing page visibility', () => {
    const state = transitionSeo(transitionSeo(initialPageState(), 'about', 'save-draft', seo()), 'about', 'publish')
    const restored = transitionSeo(state, 'about', 'restore')
    expect(restored.mode).toBe(state.mode)
    expect(restored.draft).toEqual(state.draft)
    expect(currentSeo(restored, 'about').text.en.title).toBe('')
  })
  it('requires a saved SEO draft and only exposes actual static editors', () => {
    expect(() => transitionSeo(initialPageState(), 'about', 'publish')).toThrow()
    expect(isSeoPage('about')).toBe(true)
    expect(isSeoPage('trips')).toBe(true)
    expect(isSeoPage('planner')).toBe(true)
    expect(isSeoPage('blog-detail')).toBe(false)
    expect(isSeoPage('shared')).toBe(false)
  })
  it('does not resurrect old mandatory page copy when hiding a restored page', () => {
    const content = originalPageContent('privacy')
    content.sections[0].text.en.heading = 'OLD CUSTOM HEADING'
    let state = transitionPageContent(initialPageState(), 'save-draft', content, 'privacy')
    state = transitionPageContent(state, 'publish', undefined, 'privacy')
    state = transitionSeo(transitionSeo(state, 'privacy', 'save-draft', seo()), 'privacy', 'publish')
    state = transitionPageContent(state, 'restore', undefined, 'privacy')
    state = transitionPageContent(state, 'unpublish', undefined, 'privacy')
    expect(publicPageContent(state, 'privacy').content?.sections[0].text.en.heading).toBe(originalPageContent('privacy').sections[0].text.en.heading)
    expect(publicPageContent(state, 'privacy').content?.seo.text.en.title).toBe('Egypt journeys')
  })
})
describe('SEO trust boundary and actual metadata', () => {
  it.each(['https://evil.test', '//evil.test', '/account', '/admin/settings', '/login', '/about?x=1', '/about#x', '/..', '/about//x'])('rejects unsafe canonical %s', canonical => {
    expect(() => validateSeoContent({ ...seo(), canonical })).toThrow()
  })
  it.each(['javascript:alert(1)', 'data:text/html,foo'])('rejects unsafe media %s', image => {
    expect(() => validateSeoContent({ ...seo(), image })).toThrow()
  })
  it('rejects script markup, arbitrary schema/scripts and invalid options', () => {
    const invalid = seo(); invalid.text.en.title = '<script>alert(1)</script>'
    expect(() => validateSeoContent(invalid)).toThrow()
    expect(() => validateSeoContent({ ...seo(), jsonLd: {} })).toThrow()
    expect(() => validateSeoContent({ ...seo(), index: 'false' })).toThrow()
    expect(() => validateSeoContent({ ...seo(), card: 'unsafe' })).toThrow()
  })
  it('preserves previously valid multiline CMS SEO rather than breaking stored page decoding', () => {
    const content = seo()
    content.text.en.description = 'First line\nSecond line\tmore'
    expect(validateSeoContent(content).text.en.description).toBe(content.text.en.description)
  })
  it.each(['en', 'es', 'it'] as const)('renders %s absolute title/social metadata and only real alternate URLs', locale => {
    const content = validateSeoContent({ ...seo(), canonical: '/about', index: false, follow: false, image: 'https://starpyramids.com/logo.png' })
    const metadata = seoMetadata(content, locale, 'https://starpyramids.com')
    expect(metadata.title).toEqual({ absolute: content.text[locale].title })
    expect(metadata.description).toBe(content.text[locale].description)
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates?.languages).toEqual({ en: 'https://starpyramids.com/about', 'x-default': 'https://starpyramids.com/about' })
    expect(metadata.twitter).toMatchObject({ images: ['https://starpyramids.com/logo.png'] })
  })
})
