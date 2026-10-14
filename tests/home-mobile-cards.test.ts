import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import postcss from 'postcss'

describe('homepage mobile card tracks', () => {
  it('keeps tours and blogs non-shrinking in a mobile-only horizontal track', () => {
    const root = postcss.parse(readFileSync('app/mobile-shell.css', 'utf8'))
    for (const selector of ['.home-section .compact-tour-grid', '.home-section .blog-home-grid']) {
      let track: Record<string, string> | undefined
      let card: Record<string, string> | undefined
      root.walkRules((rule) => {
        if (!rule.selectors.includes(selector) && !rule.selectors.includes(selector + '>*')) return
        expect(rule.parent?.type).toBe('atrule')
        expect((rule.parent as postcss.AtRule).params).toBe('screen and (max-width:760px)')
        const declarations: Record<string, string> = {}
        rule.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value })
        if (rule.selectors.includes(selector)) track = declarations
        if (rule.selectors.includes(selector + '>*')) card = declarations
      })
      expect(track).toMatchObject({ display: 'flex', 'flex-wrap': 'nowrap', 'overflow-x': 'auto' })
      expect(card).toMatchObject({ flex: '0 0 86%', width: '86%', 'min-width': '0', 'scroll-snap-align': 'start' })
    }
  })
})
