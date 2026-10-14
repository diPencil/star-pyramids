import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { FAQ_HERO_KEY, originalFaqHero, initialFaqHeroState, publicFaqHero, transitionFaqHero, validateFaqHero } from '@/lib/faq-hero'

describe('FAQ hero preservation and publishing', () => {
  it('matches every original EN/ES/IT visible hero field exactly', () => {
    const file = ts.createSourceFile('extended-pages.tsx', readFileSync('components/extended-pages.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let hero: ts.JsxSelfClosingElement | undefined
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'FAQPage') {
        const find = (child: ts.Node) => { if (ts.isJsxSelfClosingElement(child) && child.tagName.getText(file) === 'EditorialHero') hero = child; ts.forEachChild(child, find) }
        ts.forEachChild(node, find)
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(hero).toBeDefined()
    const original = originalFaqHero()
    for (const [attribute, field] of Object.entries({ title: 'heading', eyebrow: 'eyebrow', copy: 'description', action: 'action' } as const)) {
      const prop = hero!.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === attribute) as ts.JsxAttribute
      const expression = (prop.initializer as ts.JsxExpression).expression as ts.CallExpression
      const translations = expression.arguments[1] as ts.ObjectLiteralExpression
      for (const locale of ['en', 'es', 'it'] as const) {
        const value = translations.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText(file) === locale) as ts.PropertyAssignment
        expect((value.initializer as ts.StringLiteral).text).toBe(original.text[locale][field])
      }
    }
    expect(original.image).toBe('https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85')
    expect(original.href).toBe('/contact')
    expect(validateFaqHero(original)).toEqual(original)
  })
  it('does not expose a saved draft publicly or mutate prior state', () => {
    const initial = initialFaqHeroState()
    const draft = transitionFaqHero(initial, 'save-draft', originalFaqHero())
    expect(publicFaqHero(draft)).toEqual({ hidden: false, content: null })
    expect(initial.revision).toBe(0)
    expect(initial.draft).toBeNull()
    expect(FAQ_HERO_KEY).not.toBe('cms.hero.homepage.v1')
  })
  it('publishes only a saved valid draft; later edits do not affect publication', () => {
    expect(() => transitionFaqHero(initialFaqHeroState(), 'publish')).toThrow()
    const published = transitionFaqHero(transitionFaqHero(initialFaqHeroState(), 'save-draft', originalFaqHero()), 'publish')
    const changed = originalFaqHero(); changed.text.en.heading = 'New draft'
    const next = transitionFaqHero(published, 'save-draft', changed)
    expect(publicFaqHero(next).content?.text.en.heading).toBe(originalFaqHero().text.en.heading)
    expect(next.draft?.text.en.heading).toBe('New draft')
  })
  it('keeps unpublish explicit and restores only by explicit action', () => {
    const hidden = transitionFaqHero(initialFaqHeroState(), 'unpublish')
    expect(publicFaqHero(transitionFaqHero(hidden, 'save-draft', originalFaqHero()))).toEqual({ hidden: true, content: null })
    expect(publicFaqHero(transitionFaqHero(hidden, 'restore')).content).toEqual(originalFaqHero())
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.com', '/egypt-tours/not-published', 'https://external.example'])('rejects unsupported CTA destination %s', (href) => {
    expect(() => validateFaqHero({ ...originalFaqHero(), href })).toThrow()
  })
  it('rejects missing translations, script content and invalid media', () => {
    const hero = originalFaqHero(); hero.text.it.action = ''
    expect(() => validateFaqHero(hero)).toThrow()
    hero.text.it.action = '<script>'
    expect(() => validateFaqHero(hero)).toThrow()
    expect(() => validateFaqHero({ ...originalFaqHero(), image: 'http://unsafe.example/image.jpg' })).toThrow()
  })
  it('keeps the existing editorial layout classes and protected inert preview', () => {
    const source = readFileSync('components/extended-pages.tsx', 'utf8')
    for (const value of ['className="editorial-hero"', 'className="editorial-overlay"', 'className="container editorial-content"', 'className="primary-btn"']) expect(source).toContain(value)
    const preview = readFileSync('app/website-cms-preview/faq/page.tsx', 'utf8')
    expect(preview).toContain("hasPermission(user, 'settings.view')")
    expect(preview).toContain('<div inert><FAQPage />')
  })
})
