import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { EDITORIAL_HERO_IDS, isEditorialHeroId, originalEditorialHero, validateEditorialHero } from '@/lib/editorial-hero-definitions'
import { validateFaqHero } from '@/lib/faq-hero'

describe('editorial hero identity and original content', () => {
  it('allows only implemented identities, not arbitrary SiteSetting keys', () => {
    expect(EDITORIAL_HERO_IDS).toEqual(['faq', 'destinations', 'guide', 'accessible'])
    for (const value of ['__proto__', '../faq', 'homepage', 'DATABASE_URL']) expect(isEditorialHeroId(value)).toBe(false)
    for (const id of EDITORIAL_HERO_IDS) expect(validateFaqHero(originalEditorialHero(id))).toEqual(originalEditorialHero(id))
  })
  it('matches existing destination hero translations without changing the original layout', () => {
    const file = ts.createSourceFile('extended-pages.tsx', readFileSync('components/extended-pages.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let hero: ts.JsxSelfClosingElement | undefined
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'DestinationsPageContent') {
        const find = (child: ts.Node) => { if (ts.isJsxSelfClosingElement(child) && child.tagName.getText(file) === 'DestinationCatalogueHero') hero = child; ts.forEachChild(child, find) }
        ts.forEachChild(node, find)
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    expect(hero).toBeDefined()
    const original = originalEditorialHero('destinations')
    for (const [attribute, field] of Object.entries({ title: 'heading', eyebrow: 'eyebrow', copy: 'description', action: 'action' } as const)) {
      const prop = hero!.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === attribute) as ts.JsxAttribute
      const expression = (prop.initializer as ts.JsxExpression).expression as ts.CallExpression
      const translations = expression.arguments[1] as ts.ObjectLiteralExpression
      for (const locale of ['en', 'es', 'it'] as const) {
        const value = translations.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText(file) === locale) as ts.PropertyAssignment
        expect((value.initializer as ts.StringLiteral).text).toBe(original.text[locale][field])
      }
    }
    const image = hero!.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'image') as ts.JsxAttribute
    expect((image.initializer as ts.JsxExpression).expression?.getText(file)).toBe('siteImages.desert')
    expect(original.image).toBe('https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=85')
    expect(original.href).toBe('/make-your-trip')
  })
  it.each([undefined, null, '', '   '])('preserves legacy destination text with missing optional media: %s', image => {
    const original = originalEditorialHero('destinations')
    const content = validateEditorialHero('destinations', { ...original, image })
    expect(content.text).toEqual(original.text)
    expect(content.image).toBe(original.image)
    expect(() => validateEditorialHero('destinations', { ...original, image: 'javascript:alert(1)' })).toThrow()
  })
  it('lists information pages only after their real routes use the CMS renderer', () => {
    const catalogue = readFileSync('lib/hero-catalogue.ts', 'utf8')
    for (const [id, path] of [['guide', 'egypt-travel-guide'], ['accessible', 'accessible-travel']]) {
      expect(catalogue).toContain(`id: '${id}'`)
      const route = readFileSync(`app/${path}/page.tsx`, 'utf8')
      expect(route).toContain(`readFaqHeroState('${id}')`)
      expect(route).toContain(`<InformationPage id="${id}"`)
    }
    const route = readFileSync('app/destinations/page.tsx', 'utf8')
    expect(route).toContain("readFaqHeroState('destinations')")
    expect(route).toContain('<DestinationsPage initialDestinations=')
  })
})
