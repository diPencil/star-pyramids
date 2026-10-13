import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss, { type AtRule, type Container } from 'postcss'
import { describe, expect, it } from 'vitest'

const files = ['app/mobile-shell.css', 'app/admin/mobile.css', 'app/account/mobile.css']
const newControls = new Set([
  '.mobile-header-search,.mobile-bottom-nav',
  '.mobile-nav:not([open])',
  '.trips-mobile-filter-toggle,.trips-mobile-filter-done,.mobile-booking-shortcut',
  '.customer-drawer-close,.customer-drawer-website',
])

describe('mobile presentation safety', () => {
  it('keeps changes to existing UI inside responsive or reduced-motion rules', () => {
    for (const file of files) {
      const css = postcss.parse(readFileSync(resolve(file), 'utf8'), { from: file })
      css.walkRules((rule) => {
        if (newControls.has(rule.selector)) return
        let responsive = false
        for (let parent: Container | undefined = rule.parent; parent; parent = parent.parent) {
          if (parent.type === 'atrule') {
            const at = parent as AtRule
            if (at.name === 'media' && /max-width|prefers-reduced-motion/.test(at.params)) responsive = true
          }
        }
        expect(responsive, `${file}: unscoped desktop change in ${rule.selector}`).toBe(true)
      })
    }
  })

  it('never hides operational or financial table cells to fit mobile widths', () => {
    for (const file of files) {
      const css = postcss.parse(readFileSync(resolve(file), 'utf8'), { from: file })
      css.walkRules((rule) => {
        if (!/\.(?:sp|customer)-table\b/.test(rule.selector)) return
        rule.walkDecls('display', (decl) => {
          expect(decl.value, `${file}: hidden table data in ${rule.selector}`).not.toBe('none')
        })
      })
    }
  })
})
