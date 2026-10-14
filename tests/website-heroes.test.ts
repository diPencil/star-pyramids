import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { heroCatalogue } from '@/lib/hero-catalogue'
import { originalHomeHero, initialHeroState, transitionHero, validateHomeHero, validateHeroMedia, publicHeroState } from '@/lib/website-heroes'
import { HomepageHero } from '@/components/homepage-hero'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'

describe('Website CMS hero lifecycle', () => {
  it('retains original defaults without inserting a record', () => {
    expect(publicHeroState(initialHeroState())).toEqual({ hidden: false, content: null })
    expect(originalHomeHero().mediaUrl).toBe('/egypt-hero.png')
    expect(validateHomeHero(originalHomeHero())).toEqual(originalHomeHero())
  })
  it('keeps private drafts out of public data and does not mutate prior state', () => {
    const before = initialHeroState()
    const draft = originalHomeHero(); draft.text.en.heading = 'Private draft'
    const saved = transitionHero(before, 'save-draft', draft)
    expect(publicHeroState(saved)).toEqual({ hidden: false, content: null })
    expect(before.revision).toBe(0)
    expect(saved.revision).toBe(1)
    const published = transitionHero(saved, 'publish')
    expect(publicHeroState(published).content?.text.en.heading).toBe('Private draft')
    draft.text.en.heading = 'Next private draft'
    const next = transitionHero(published, 'save-draft', draft)
    expect(publicHeroState(next).content?.text.en.heading).toBe('Private draft')
    expect(JSON.stringify(publicHeroState(next))).not.toContain('Next private draft')
  })
  it('does not fall back to original content when unpublished', () => {
    const hidden = transitionHero(transitionHero(transitionHero(initialHeroState(), 'save-draft', originalHomeHero()), 'publish'), 'unpublish')
    expect(publicHeroState(hidden)).toEqual({ hidden: true, content: null })
    const saved = transitionHero(hidden, 'save-draft', originalHomeHero())
    expect(publicHeroState(saved).hidden).toBe(true)
    const restored = transitionHero(saved, 'restore')
    expect(restored.published).toEqual(originalHomeHero())
  })
  it('requires a saved draft and complete EN/ES/IT headings', () => {
    expect(() => transitionHero(initialHeroState(), 'publish')).toThrow()
    const hero = originalHomeHero(); hero.text.es.heading = ''
    expect(() => validateHomeHero(hero)).toThrow()
  })
  it.each(['javascript:alert(1)', 'data:image/png;base64,abc', '//example.com/a.jpg', 'http://example.com/a.jpg', 'https://u:p@example.com/a.jpg', 'https://localhost/a.jpg', '/media/../../secret', 'https://127.0.0.1/a.jpg'])('rejects unsafe media URL %s', (url) => {
    expect(() => validateHeroMedia(url, 'image')).toThrow()
  })
  it.each(['https://youtube.com/watch.mp4', 'https://youtu.be/test', 'https://example.com/video', 'https://example.com/a.html'])('rejects unsupported video source %s', (url) => {
    expect(() => validateHeroMedia(url, 'video')).toThrow()
  })
  it('accepts direct HTTPS video, optional mobile fallback and valid positions only', () => {
    const hero = { ...originalHomeHero(), mediaType: 'video', mediaUrl: 'https://cdn.example.com/a.mp4' }
    expect(validateHomeHero(hero).mobileUrl).toBe('')
    expect(() => validateHomeHero({ ...hero, poster: '' })).toThrow()
    expect(() => validateHomeHero({ ...hero, overlay: 1 })).toThrow()
    expect(() => validateHomeHero({ ...hero, position: 'arbitrary CSS' })).toThrow()
    expect(() => validateHomeHero({ ...hero, unsafe: true })).toThrow()
  })
  it('retains search children when a hero is hidden or media is unavailable', () => {
    for (const state of [{ hidden: true, content: null }, { hidden: false, content: null, unavailable: true }]) {
      const markup = renderToStaticMarkup(createElement(HomepageHero, { state, heading: 'Original heading', eyebrow: 'Original', children: createElement('form', { 'data-original-search': true }) }))
      expect(markup).toContain('data-original-search')
      expect(markup).not.toContain('Original heading')
      expect(markup).not.toContain('/egypt-hero.png')
    }
  })
  it('renders translated published text with the original hero structure', () => {
    const markup = renderToStaticMarkup(createElement(InitialLocaleProvider, { locale: 'es', preview: true, children: createElement(LocaleProvider, { children: createElement(HomepageHero, { state: { hidden: false, content: originalHomeHero() }, heading: 'Fallback', eyebrow: 'Fallback', children: createElement('form', { id: 'existing-search' }) }) }) }))
    expect(markup).toContain('Viaje fascinante con nosotros')
    expect(markup).toContain('home-hero-copy')
    expect(markup).toContain('existing-search')
    expect(markup).not.toContain('<video')
  })
  it('uses unique route-template identities and deep links to existing dynamic editors', () => {
    expect(new Set(heroCatalogue.map((hero) => hero.id)).size).toBe(heroCatalogue.length)
    expect(new Set(heroCatalogue.map((hero) => hero.route)).size).toBe(heroCatalogue.length)
    expect(heroCatalogue.filter((hero) => 'cms' in hero)).toHaveLength(20)
    expect(heroCatalogue.filter((hero) => !('cms' in hero)).every((hero) => 'editor' in hero)).toBe(true)
    expect(heroCatalogue.find((hero) => hero.id === 'blog-detail')).toMatchObject({ editor: '/admin/blogs' })
    for (const hero of heroCatalogue) expect(readFileSync(hero.source, 'utf8').length).toBeGreaterThan(0)
  })
  it('keeps real homepage search composition and private draft previews', () => {
    expect(readFileSync('components/homepage.tsx', 'utf8')).toContain('<TripSearchEngine/></HomepageHero>')
    expect(readFileSync('components/homepage-hero-preview.tsx', 'utf8')).toContain('<div inert>')
    expect(readFileSync('app/website-cms-preview/homepage/page.tsx', 'utf8')).toContain('<HomepageHeroPreview')
    expect(readFileSync('app/website-cms-preview/homepage/page.tsx', 'utf8')).toContain("hasPermission(user, 'settings.view')")
  })
})
