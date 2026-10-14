import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
import { AboutPage } from '@/components/about-page'
import { ContactPage, DestinationsPage } from '@/components/extended-pages'
import { InitialLocaleProvider } from '@/components/locale'
import { PresentationProvider } from '@/components/presentation-content-context'
import { originalPageContent, validatePageContent, pageSections } from '@/lib/page-sections'
import { TEMPLATE_PAGES, type TemplatePageId } from '@/lib/template-presentation'
import { CmsImage } from '@/components/cms-image'
const render = (id: TemplatePageId, Component: typeof AboutPage, content?: ReturnType<typeof originalPageContent>) => renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'en', preview: true, children: createElement(PresentationProvider, { states: content ? { [id]: { content } } : {}, children: createElement(Component) }) }))
describe('all presentation adapters reuse the existing CMS document lifecycle', () => {
  it.each(Object.keys(TEMPLATE_PAGES) as TemplatePageId[])('validates original %s without touching records', (id) => { expect(validatePageContent(originalPageContent(id), id)).toEqual(originalPageContent(id)) })
  it.each([['about', AboutPage], ['contact', ContactPage], ['destinations', DestinationsPage]] as const)('keeps original %s public markup unchanged with explicit defaults', (id, Component) => { expect(render(id, Component, originalPageContent(id))).toBe(render(id, Component)) })
  it('consumes published text, images, links, visibility and empty repeated cards in the actual About page', () => {
    const content = originalPageContent('about')
    const story = content.sections.find(s => s.id === 'our-story')!
    story.text.en.description1 = 'Published company heading'
    story.media!.media0 = '/logo.png'
    story.links!.links0 = '/faq'
    content.sections.find(s => s.id === 'about-values')!.items = []
    content.sections.find(s => s.id === 'about-closing')!.visible = false
    const html = render('about', AboutPage, content)
    expect(html).toContain('Published company heading')
    expect(html).toContain('href="/faq"')
    expect(html).not.toContain('Your kind of Egypt')
    expect(html).not.toContain('Your Egypt is waiting.')
  })
  it('keeps enquiry form required and rejects arbitrary media/link fields', () => {
    const contact = originalPageContent('contact')
    contact.sections.find(s => s.id === 'contact-enquiry')!.visible = false
    expect(() => validatePageContent(contact, 'contact')).toThrow()
    const about = originalPageContent('about')
    about.sections[1].media!.media0 = 'javascript:alert(1)'
    expect(() => validatePageContent(about, 'about')).toThrow()
    expect(pageSections('shared').every(s => s.mandatory)).toBe(true)
  })
  it('keeps the actual Contact enquiry form usable if presentation storage is unavailable', () => {
    const html = renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'en', preview: true, children: createElement(PresentationProvider, { states: { contact: { content: null, unavailable: true } }, children: createElement(ContactPage) }) }))
    expect(html).toContain('class="contact-v2-form-wrap"')
    expect(html).toContain('type="email"')
    expect(html).not.toContain('Egypt-based local insight')
  })
  it('renders a valid public CMS image outside the optimizer allowlist without breaking the page', () => {
    const html = renderToStaticMarkup(createElement(CmsImage, { src: 'https://cdn.example.org/approved-image.jpg', alt: 'Approved image', fill: true }))
    expect(html).toContain('src="https://cdn.example.org/approved-image.jpg"')
    expect(html).not.toContain('/_next/image')
  })
  it('consumes published section order in the actual About page while preserving its hero', () => {
    const content = originalPageContent('about')
    const index = content.sections.findIndex(section => section.id === 'about-closing')
    content.sections.splice(1, 0, content.sections.splice(index, 1)[0])
    const html = render('about', AboutPage, content)
    expect(html.indexOf('class="about-closing"')).toBeLessThan(html.indexOf('id="our-story"'))
    expect(html).toContain('STAR PYRAMIDS')
  })
  it('consumes shared desktop/mobile navigation, footer and help text without changing routes', () => {
    const content = originalPageContent('shared')
    const navigation = content.sections.find(section => section.id === 'navigation')!
    navigation.text.en.home = 'Published home label'
    navigation.text.en.companyLabel = 'Published company label'
    navigation.text.en.explore = 'Published mobile explore'
    const footer = content.sections.find(section => section.id === 'footer')!
    footer.text.en.footExplore = 'Published footer heading'
    footer.text.en.allTrips = 'Published trip catalogue'
    content.sections.find(section => section.id === 'help')!.text.en.helpTitle = 'Published help heading'
    const html = renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'en', preview: true, children: createElement(PresentationProvider, { states: { shared: { content } }, children: createElement(AboutPage) }) }))
    for (const text of ['Published home label', 'Published company label', 'Published mobile explore', 'Published footer heading', 'Published trip catalogue', 'Published help heading']) expect(html).toContain(text)
    expect(html).toContain('href="/trips"')
    expect(html).toContain('href="/contact"')
    expect(html).toContain('type="email"')
  })
})
