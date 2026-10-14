import { describe, expect, it } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { HOME_SECTIONS, initialPageState, originalPageContent, publicPageContent, transitionPageContent, validatePageContent, selectPageRecords, validateCmsLink } from '@/lib/page-sections'
import { cmsPageRegistry, cmsRoutePattern, coverageCounts } from '@/lib/cms-coverage'

describe('registered page content and lifecycle', () => {
  it('matches every actual public route pattern and reports incomplete inventories honestly', () => {
    const routes: string[] = []
    function walk(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (directory === 'app' && ['admin', 'api', 'website-cms-preview'].includes(entry.name)) continue
        const name = directory + '/' + entry.name
        if (entry.isDirectory()) walk(name)
        else if (entry.name === 'page.tsx') routes.push(directory === 'app' ? '/' : directory.slice(3))
      }
    }
    walk('app')
    expect([...new Set(cmsPageRegistry.map(cmsRoutePattern))].sort()).toEqual(routes.sort())
    expect(new Set(cmsPageRegistry.map((page) => page.key)).size).toBe(cmsPageRegistry.length)
    for (const page of cmsPageRegistry) expect(existsSync(page.source)).toBe(true)
    expect(coverageCounts().uncovered).toBe(0)
    expect(coverageCounts().sharedUncovered).toBe(0)
    expect(coverageCounts().partialInventories).toBe(0)
  })
  it('validates defaults and keeps the full existing automatic selection until changed', () => {
    const original = originalPageContent()
    expect(validatePageContent(original)).toEqual(original)
    expect(original.sections.map((section) => section.id)).toEqual(HOME_SECTIONS.map((section) => section.id))
    const records = Array.from({ length: 20 }, (_, index) => ({ slug: 'record-' + index }))
    expect(selectPageRecords(original.sections.find((s) => s.id === 'blogs'), records)).toHaveLength(20)
  })
  it('keeps drafts private and publishes content/order/SEO together without mutating the previous state', () => {
    const content = originalPageContent()
    content.sections[2].text.es.xmasT = 'Viajes publicados'
    content.sections.push(content.sections.splice(2, 1)[0])
    content.seo.text.es.title = 'Título publicado'
    const before = initialPageState()
    const draft = transitionPageContent(before, 'save-draft', content)
    expect(before.revision).toBe(0)
    expect(publicPageContent(draft)).toEqual({ content: originalPageContent() })
    const published = transitionPageContent(draft, 'publish')
    expect(publicPageContent(published).content).toEqual(content)
    const edited = originalPageContent(); edited.sections[2].text.es.xmasT = 'Private next draft'
    expect(JSON.stringify(publicPageContent(transitionPageContent(published, 'save-draft', edited)))).not.toContain('Private next draft')
  })
  it('never restores hidden content or empty selections/items without explicit restore', () => {
    const content = originalPageContent()
    const featured = content.sections.find((s) => s.id === 'featured')!
    featured.visible = false; featured.selectionMode = 'selected'; featured.selection = []
    content.sections.find((s) => s.id === 'faq')!.items = []
    const published = transitionPageContent(transitionPageContent(initialPageState(), 'save-draft', content), 'publish')
    expect(selectPageRecords(featured, [{ slug: 'not-selected' }])).toEqual([])
    const hidden = publicPageContent(transitionPageContent(published, 'unpublish')).content!
    expect(hidden.sections.filter((s) => s.visible).map((s) => s.id)).toEqual(['hero', 'planner', 'help'])
    expect(hidden.sections.find((s) => s.id === 'faq')?.items).toEqual([])
    expect(publicPageContent(transitionPageContent(published, 'restore')).content).toEqual(originalPageContent())
  })
  it('rejects deleting/hiding mandatory sections and injecting business data or arbitrary style', () => {
    for (const id of ['hero', 'planner', 'help']) { const content = originalPageContent(); content.sections.find((s) => s.id === id)!.visible = false; expect(() => validatePageContent(content)).toThrow('Required') }
    const content = originalPageContent()
    expect(() => validatePageContent({ ...content, sections: content.sections.slice(1) })).toThrow()
    expect(() => validatePageContent({ ...content, sections: [content.sections[1], content.sections[0], ...content.sections.slice(2)] })).toThrow()
    expect(() => validatePageContent({ ...content, sections: content.sections.map((s) => s.id === 'featured' ? { ...s, price: 1, css: 'position:fixed' } : s) })).toThrow()
    const faq = content.sections.find((s) => s.id === 'faq')!
    faq.items![0].text.it.question = ''
    expect(() => validatePageContent(content)).toThrow('IT question')
  })
  it.each(['javascript:alert(1)', '//example.com', '/admin', '/checkout', 'https://u:p@example.com', 'https://localhost/test', '/blogs/../../secret'])('rejects unsafe/inappropriate CTA %s', (url) => {
    expect(() => validateCmsLink(url)).toThrow()
  })
  it('accepts a real public content reference or secure external link without copying records', () => {
    expect(validateCmsLink('/blogs/existing-article')).toBe('/blogs/existing-article')
    expect(validateCmsLink('https://example.com/travel')).toBe('https://example.com/travel')
  })
})
