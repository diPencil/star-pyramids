import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { heroCatalogue } from '@/lib/hero-catalogue'
import { EDITORIAL_HERO_IDS } from '@/lib/editorial-hero-definitions'
import { showcaseDefaults } from '@/lib/showcase-hero-defaults'
import { SHOWCASE_HERO_IDS, isShowcaseHeroId, originalShowcaseHero, initialShowcaseState, transitionShowcaseHero, publicShowcaseHero, validateShowcaseHero, readShowcasePreviewMessage } from '@/lib/showcase-heroes'

const parse = (path: string) => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function visit(node: ts.Node, fn: (node: ts.Node) => void) { fn(node); ts.forEachChild(node, (child) => visit(child, fn)) }
function literalText(node: ts.Node | undefined): Record<string, string> | null {
  if (!node) return null
  if (ts.isStringLiteralLike(node)) return { en: node.text, es: node.text, it: node.text }
  if (ts.isJsxExpression(node)) return literalText(node.expression)
  if (ts.isCallExpression(node) && ['tx', 'pickLocaleText'].includes(node.expression.getText())) {
    const obj = node.arguments[1]
    if (!obj || !ts.isObjectLiteralExpression(obj)) return null
    const values: Record<string, string> = {}
    for (const prop of obj.properties) if (ts.isPropertyAssignment(prop) && ts.isStringLiteralLike(prop.initializer)) values[prop.name.getText().replace(/['"]/g, '')] = prop.initializer.text
    return values.en ? { en: values.en, es: values.es ?? values.en, it: values.it ?? values.en } : null
  }
  return null
}
describe('all existing static showcase heroes', () => {
  it('has one real editor per static table row and no pending fake actions', () => {
    expect(SHOWCASE_HERO_IDS).toHaveLength(15)
    const managed = heroCatalogue.filter((hero) => 'cms' in hero)
    // Includes guide/accessible editorial pages, not just the original trio.
    expect(managed.map(hero => hero.id).sort()).toEqual([...SHOWCASE_HERO_IDS, ...EDITORIAL_HERO_IDS, 'homepage'].sort())
    expect(new Set(managed.map(hero => hero.id)).size).toBe(managed.length)
    expect(heroCatalogue.filter((hero) => !('cms' in hero)).every((hero) => 'editor' in hero)).toBe(true)
    expect(isShowcaseHeroId('__proto__')).toBe(false)
    expect(isShowcaseHeroId('../about')).toBe(false)
  })
  for (const id of SHOWCASE_HERO_IDS) {
    it(`${id}: validates original content, isolates drafts and respects unpublish`, () => {
      const content = originalShowcaseHero(id)
      expect(validateShowcaseHero(id, content)).toEqual(content)
      const draft = transitionShowcaseHero(id, initialShowcaseState(), 'save-draft', content)
      expect(publicShowcaseHero(draft)).toEqual({ hidden: false, content: null })
      const published = transitionShowcaseHero(id, draft, 'publish')
      expect(publicShowcaseHero(published).content).toEqual(content)
      const hidden = transitionShowcaseHero(id, published, 'unpublish')
      expect(publicShowcaseHero(transitionShowcaseHero(id, hidden, 'save-draft', content)).hidden).toBe(true)
      const restored = transitionShowcaseHero(id, hidden, 'restore')
      expect(restored.mode).toBe('original')
      expect(restored.published).toBeNull()
      expect(content.image).toBe('')
    })
  }
  it('captures exact localized copy from all original PageShowcaseHero instances', () => {
    for (const [path, ids] of [['components/about-page.tsx', ['about']], ['components/extended-pages.tsx', ['contact', 'cars', 'blogs', 'offers']]] as const) {
      const root = parse(path), tags: ts.JsxSelfClosingElement[] = []
      visit(root, (node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'PageShowcaseHero' && !node.getText().includes('railHref="#destinations-catalogue"')) tags.push(node) })
      for (const [index, id] of ids.entries()) {
        const original = originalShowcaseHero(id)
        for (const attr of tags[index].attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue
          const field = attr.name.getText(), text = literalText(attr.initializer)
          if (text && Object.hasOwn(original.text.en, field)) for (const locale of ['en', 'es', 'it'] as const) expect(original.text[locale][field]).toBe(text[locale])
        }
      }
    }
  })
  it('preserves the exact source category title/intro values and leaves featured records dynamic', () => {
    const file = parse('data/tours.ts')
    let categories: ts.ObjectLiteralExpression | undefined
    visit(file, (node) => { if (ts.isVariableDeclaration(node) && node.name.getText() === 'tourCategories' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) categories = node.initializer })
    for (const [id, slug] of [['one-day', 'one-day-tours'], ['multi-day', 'multi-days-tours'], ['nile', 'nile-cruises'], ['shore', 'shore-excursions']] as const) {
      const category = categories!.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText().replace(/['"]/g, '') === slug) as ts.PropertyAssignment
      const values = category.initializer as ts.ObjectLiteralExpression
      for (const field of ['title', 'intro']) {
        const value = values.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText() === field) as ts.PropertyAssignment
        for (const locale of ['en', 'es', 'it'] as const) expect(originalShowcaseHero(id).text[locale][field]).toBe((value.initializer as ts.StringLiteral).text)
      }
    }
    for (const id of ['cars', 'blogs', 'offers', 'events', 'one-day', 'multi-day', 'nile', 'shore'] as const) {
      expect(originalShowcaseHero(id).text.en).not.toHaveProperty('railTitle')
      expect(originalShowcaseHero(id).links).not.toHaveProperty('secondaryHref')
      expect(originalShowcaseHero(id).links).not.toHaveProperty('railHref')
    }
  })
  it('rejects injected fields, foreign anchors, unsafe links and untranslated required copy', () => {
    const valid = originalShowcaseHero('about')
    expect(() => validateShowcaseHero('about', { ...valid, text: { ...valid.text, en: { ...valid.text.en, price: '0' } } })).toThrow()
    expect(() => validateShowcaseHero('about', { ...valid, links: { ...valid.links, primaryHref: 'javascript:alert(1)' } })).toThrow()
    expect(() => validateShowcaseHero('about', { ...valid, links: { ...valid.links, primaryHref: '#events-list' } })).toThrow()
    expect(() => validateShowcaseHero('about', { ...valid, text: { ...valid.text, it: { ...valid.text.it, title: '' } } })).toThrow()
    expect(() => validateShowcaseHero('blogs', { ...originalShowcaseHero('blogs'), links: { primaryHref: '#blog-stories', railHref: '/blogs/hidden' } })).toThrow()
  })
  it('accepts media overrides without copying featured source data', () => {
    const content = { ...originalShowcaseHero('contact'), image: 'https://example.com/desktop.jpg', mobileImage: 'https://example.com/mobile.jpg', overlay: 0.5 }
    expect(validateShowcaseHero('contact', content)).toEqual(content)
    expect(() => validateShowcaseHero('contact', { ...content, image: 'http://example.com/image.jpg' })).toThrow()
  })
  it('only accepts valid live messages from its own same-origin parent and hero identity', () => {
    const parent = {} as Window, origin = 'https://example.com'
    const event = { source: parent, origin, data: { type: 'star-showcase-preview', id: 'about', locale: 'es', content: originalShowcaseHero('about') } }
    expect(readShowcasePreviewMessage('about', event, origin, parent, true)?.locale).toBe('es')
    expect(readShowcasePreviewMessage('about', { ...event, origin: 'https://other.example' }, origin, parent, true)).toBeNull()
    expect(readShowcasePreviewMessage('contact', event, origin, parent, true)).toBeNull()
    expect(readShowcasePreviewMessage('about', event, origin, {} as Window, true)).toBeNull()
    expect(readShowcasePreviewMessage('about', event, origin, parent, false)).toBeNull()
  })
  it('retains exact source DOM for original media and inert protected previews', () => {
    const source = readFileSync('components/site.tsx', 'utf8')
    expect(source).toContain('fill priority sizes="100vw" className="hero-bg-img"')
    expect(source).toContain("content.position !== 'source' ? { objectPosition: content.position } : undefined")
    expect(source).toContain('railTitle = text.railTitle ?? railTitle')
    expect(readFileSync('components/showcase-hero-preview.tsx', 'utf8')).toContain('<div inert>{children}</div>')
    expect(readFileSync('app/website-cms-preview/showcase/[id]/page.tsx', 'utf8')).toContain("hasPermission(user, 'settings.view')")
    expect(Object.keys(showcaseDefaults)).toHaveLength(10)
  })
})
