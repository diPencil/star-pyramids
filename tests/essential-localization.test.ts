import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { getBotReply } from '@/components/live-chat'
import { customerErrorCopy, customerErrorText } from '@/lib/customer-error-copy'

describe('essential customer localization', () => {
  it.each([
    ['es', 'hola', '¡Hola!'], ['it', 'ciao', 'Ciao!'],
    ['es', 'precios', 'por persona'], ['it', 'prezzi', 'a persona'],
    ['es', 'reservar', 'Reservar es fácil'], ['it', 'prenotare', 'Prenotare è semplice'],
    ['es', 'cruceros', 'categorías'], ['it', 'crociere', 'categorie'],
    ['es', 'agente', 'Por supuesto'], ['it', 'operatore', 'Certamente'],
    ['es', 'gracias', 'De nada'], ['it', 'grazie', 'Prego'],
    ['es', 'xyz', 'Entendido'], ['it', 'xyz', 'Ricevuto'],
  ] as const)('answers %s input %s in the selected language', (locale, prompt, phrase) => {
    const reply = getBotReply(prompt, locale, '$125.40')
    expect(reply.text).toContain(phrase)
    expect(reply.text).not.toBe(getBotReply(prompt, 'en', '$125.40').text)
    expect(reply.chips.length).toBeGreaterThan(0)
    if (prompt === 'precios' || prompt === 'prezzi') {
      expect(reply.text).toContain('$125.40')
      expect(reply.text).not.toContain('{price}')
    }
  })

  it('keeps legacy English and Arabic assistant behavior', () => {
    expect(getBotReply('price', 'en', '$10').text).toContain('from $10 per person')
    expect(getBotReply('سعر', 'ar', '$10').text).toContain('$10')
    expect(getBotReply('book', 'en', '$10').chips).toEqual(['plan', 'browse'])
  })

  it('requires EN/ES/IT for inline UI copy in essential journey components', () => {
    const paths = ['site', 'cart-page', 'checkout-page', 'tour-detail', 'day-tour-detail', 'trips-page', 'account-custom-trip', 'account-portal', 'event-request-form']
    let checked = 0
    for (const name of paths) {
      const path = `components/${name}.tsx`
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'tx' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
          const keys = node.arguments[1].properties.map((property) => property.name && ts.isStringLiteral(property.name) ? property.name.text : property.name?.getText(source))
          for (const locale of ['en', 'es', 'it']) expect(keys, `${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`).toContain(locale)
          checked++
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('covers literal tour UI lookups instead of silently returning English', () => {
    const path = 'components/tour-detail.tsx'
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const dictionaries: Set<string>[] = []
    const collect = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ['spanishUi', 'italianUi'].includes(node.name.getText(source)) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        dictionaries.push(new Set(node.initializer.properties.map((property) => property.name && ts.isStringLiteral(property.name) ? property.name.text : property.name?.getText(source) ?? '')))
      }
      ts.forEachChild(node, collect)
    }
    collect(source)
    expect(dictionaries).toHaveLength(2)
    const check = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'ui' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        for (const dictionary of dictionaries) expect(dictionary.has(node.arguments[0].text), node.arguments[0].text).toBe(true)
      }
      ts.forEachChild(node, check)
    }
    check(source)
  })

  it('covers every literal contact API error without touching the API contract', () => {
    const path = 'app/api/enquiries/route.ts'
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'error' && ts.isStringLiteral(node.initializer)) {
        expect(Object.hasOwn(customerErrorCopy, node.initializer.text), node.initializer.text).toBe(true)
        expect(customerErrorText('es', node.initializer.text)).not.toBe(node.initializer.text)
        expect(customerErrorText('it', node.initializer.text)).not.toBe(node.initializer.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  })
})
