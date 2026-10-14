import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/site', async () => {
  const actual = await vi.importActual<typeof import('@/components/site')>('@/components/site')
  const { LocaleProvider } = await vi.importActual<typeof import('@/components/locale')>('@/components/locale')
  return { ...actual, SiteShell: ({ children }: { children: ReactNode }) => createElement(LocaleProvider, { children }) }
})
import { InformationPage } from '@/components/information-page'
import { FaqHeroProvider } from '@/components/faq-hero-context'
import { InitialLocaleProvider } from '@/components/locale'
import { initialFaqHeroState, transitionFaqHero, type PublicFaqHero } from '@/lib/faq-hero'
import { publicEditorialHero, validateEditorialHero } from '@/lib/editorial-hero-definitions'
import { INFORMATION_PAGE_IDS, originalInformationPage, type InformationPageId } from '@/lib/information-pages'
import type { EnabledLocale } from '@/lib/locale-config'

const render = (id: InformationPageId, locale: EnabledLocale, state: PublicFaqHero) => renderToStaticMarkup(
  createElement(InitialLocaleProvider, { locale, preview: true, children: createElement(FaqHeroProvider, { state, children: createElement(InformationPage, { id }) }) }),
)

describe('information page rendering and authoritative CMS sections', () => {
  it.each(INFORMATION_PAGE_IDS)('%s renders complete translated sections and real destinations', (id) => {
    const original = originalInformationPage(id)
    expect(validateEditorialHero(id, original)).toEqual(original)
    for (const locale of ['en', 'es', 'it'] as const) {
      const html = render(id, locale, publicEditorialHero(id, initialFaqHeroState()))
      expect(html).toContain('editorial-hero')
      expect(html).toContain(original.text[locale].heading)
      expect(html.match(/<h1[ >]/g)).toHaveLength(1)
      for (const section of original.sections!) {
        expect(html).toContain(section.text[locale].heading)
        expect(html).toContain(`href="${section.href}"`)
      }
    }
  })
  it.each(INFORMATION_PAGE_IDS)('%s never restores deliberately removed sections or reveals a private draft', (id) => {
    const original = originalInformationPage(id)
    const content = { ...original, sections: [] }
    const published = transitionFaqHero(transitionFaqHero(initialFaqHeroState(), 'save-draft', content), 'publish')
    const draft = originalInformationPage(id)
    draft.text.en.heading = 'Private edited heading'
    const edited = transitionFaqHero(published, 'save-draft', draft)
    const publicState = publicEditorialHero(id, edited)
    expect(publicState.content?.sections).toEqual([])
    expect(render(id, 'en', publicState)).not.toContain('Private edited heading')
    expect(render(id, 'en', publicState)).not.toContain(original.sections![0].text.en.heading)
    const hidden = publicEditorialHero(id, transitionFaqHero(edited, 'unpublish'))
    expect(hidden.content?.sections).toEqual([])
    expect(render(id, 'en', hidden)).not.toContain('editorial-hero')
    expect(publicEditorialHero(id, transitionFaqHero(edited, 'restore', undefined, original)).content).toEqual(original)
  })
  it('shows a recoverable read failure without fabricating original page content', () => {
    const html = render('guide', 'en', { hidden: false, content: null, unavailable: true })
    expect(html).toContain('temporarily unavailable')
    expect(html).toContain('href="/contact"')
    expect(html).not.toContain('Ancient civilization')
  })
  it.each(INFORMATION_PAGE_IDS)('%s keeps original body when only an uninitialized hero is hidden', (id) => {
    const original = originalInformationPage(id)
    const state = publicEditorialHero(id, transitionFaqHero(initialFaqHeroState(), 'unpublish'))
    const html = render(id, 'en', state)
    expect(html).not.toContain('editorial-hero')
    expect(html).toContain(original.sections![0].text.en.heading)
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    expect(html).not.toContain('<form')
  })
  it('requires complete localized sections, safe links and unique identities', () => {
    const content = originalInformationPage('guide')
    const section = content.sections![0]
    for (const sections of [
      [section, section],
      [{ ...section, id: '../unsafe' }],
      [{ ...section, href: 'javascript:alert(1)' }],
      [{ ...section, text: { ...section.text, es: { ...section.text.es, heading: '' } } }],
      [{ ...section, text: { ...section.text, en: { ...section.text.en, description: '<script>alert(1)</script>' } } }],
      Array.from({ length: 9 }, (_, index) => ({ ...section, id: 'section-' + index })),
    ]) expect(() => validateEditorialHero('guide', { ...content, sections })).toThrow()
    expect(() => validateEditorialHero('guide', { ...content, sections: undefined })).toThrow()
    expect(() => validateEditorialHero('faq', content)).toThrow()
  })
})
