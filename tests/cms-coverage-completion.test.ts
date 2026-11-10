import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cmsPageRegistry, cmsSharedRegistry, coverageCounts } from '@/lib/cms/cms-coverage'
import { TEMPLATE_PAGES, templateSections, type TemplatePageId } from '@/lib/cms/templates/template-presentation'
import { originalPageContent, validatePageContent } from '@/lib/cms/page-sections'
import postcss from 'postcss'
const sources = ['components/content/about-page.tsx', 'components/extended-pages.tsx', "components/cars/car-pages.tsx", "components/enquiries/contact-page.tsx", "components/account/password-recovery-pages.tsx", "components/content/public-content-pages.tsx", "components/events/event-pages.tsx", "components/content/blog-pages.tsx", "components/content/destination-pages.tsx", "components/offers/offer-pages.tsx", "components/account/legacy-account-page.tsx", 'components/offers/offer-campaigns.tsx'].map(path => readFileSync(path, 'utf8')).join('\n')
describe('remaining content coverage has actual consumers', () => {
  it('accounts for every registered block with explicit original-source ownership', () => {
    const counts = coverageCounts()
    expect(counts.uncovered).toBe(0); expect(counts.sharedUncovered).toBe(0); expect(counts.partialInventories).toBe(0)
    for (const page of cmsPageRegistry) for (const section of page.sections) {
      if (section.owner === 'cms' || section.owner === 'business') expect(section.editor).toMatch(/^\/admin\//)
    }
    expect(cmsSharedRegistry.filter(section => section.owner === 'cms')).toHaveLength(3)
    expect(counts).toMatchObject({ pages: 59, routePatterns: 56, sections: 169, cms: 81, business: 23, functional: 65, shared: 11 })
  })
  it.each(Object.keys(TEMPLATE_PAGES).filter(id => id !== 'shared') as TemplatePageId[])('consumes every registered %s text/media/link field in original public components', id => {
    for (const section of templateSections(id).filter(section => section.id !== 'hero')) {
      for (const field of [...section.fields, ...(section.mediaFields ?? []), ...(section.linkFields ?? [])]) {
        const pattern = new RegExp('cms\\.(?:text|media|link)\\([\"\x27]' + section.id + '[\"\x27]\\s*,\\s*[\"\x27]' + field + '[\"\x27]')
        expect(sources, `${id}/${section.id}/${field}`).toMatch(pattern)
      }
      if (section.itemFields) expect(sources).toMatch(new RegExp('cms\\.(?:items|cards)\\([\"\x27]' + section.id + '[\"\x27]'))
    }
  })
  it('keeps shared brand/contact data outside CMS copy and prevents blank mandatory labels', () => {
    const content = originalPageContent('shared')
    const navigation = content.sections.find(section => section.id === 'navigation')!
    expect(navigation.text.en).not.toHaveProperty('logo')
    expect(navigation.text.en).not.toHaveProperty('email')
    navigation.text.en.home = ''
    expect(() => validatePageContent(content, 'shared')).toThrow()
  })
  it('keeps shared form submission real, deduplicated and success dependent on API acceptance', () => {
    const source = readFileSync('components/shared/shared-help-cta.tsx', 'utf8')
    expect(source).toContain("fetch('/api/enquiries'")
    expect(source).toContain('if (lock.current) return')
    expect(source).toContain('requestId: pending.current.requestId')
    expect(source).toContain("typeof data?.enquiry?.publicId !== 'string'")
    expect(source).toContain('type="email" required')
    expect(source).not.toContain('alert(')
  })
  it('retains scoped desktop/tablet/mobile form tracks even when an error message is present', () => {
    const root = postcss.parse(readFileSync('components/shared/shared-help-cta.css', 'utf8'))
    const columns: string[] = []
    root.walkDecls('grid-template-columns', declaration => { columns.push(declaration.value) })
    expect(columns).toEqual(['repeat(4,minmax(0,1fr)) auto', 'repeat(2,minmax(0,1fr))', 'minmax(0,1fr)'])
    root.walkRules(rule => { expect(rule.selector).toContain('.shared-trip-help'); expect(rule.selector).not.toContain(':last-child') })
  })
})
