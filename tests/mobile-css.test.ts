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
  it('lets catalogue copy determine mobile hero height and keeps long translated actions within its column', () => {
    const css = postcss.parse(readFileSync(resolve('app/mobile-shell.css'), 'utf8'))
    const rules = new Map<string, Record<string, string>>()
    css.walkRules(rule => {
      if (!rule.selector.startsWith('.tour-category-page-hero')) return
      expect((rule.parent as AtRule).params).toBe('screen and (max-width:760px)')
      const values: Record<string, string> = {}
      rule.walkDecls(decl => { values[decl.prop] = decl.value })
      rules.set(rule.selector, values)
    })
    expect(rules.get('.tour-category-page-hero')).toMatchObject({ 'min-height': '0', 'align-items': 'stretch' })
    expect(rules.get('.tour-category-page-hero .events-page-hero-content')).toMatchObject({ 'grid-template-columns': 'minmax(0,1fr)', 'padding-block': '70px 28px' })
    expect(rules.get('.tour-category-page-hero .events-page-hero-actions :is(.primary-btn,.events-hero-link)')).toMatchObject({ 'white-space': 'normal', 'height': 'auto', 'min-height': '48px', 'max-width': '100%' })
    // The shipped square image has roughly 17% white above/below its photo.
    // This overscan removes those bands even in a tall portrait hero.
    const scale = Number(rules.get('.tour-category-page-hero .hero-bg-img[data-mobile-letterbox]')?.transform.match(/scale\(([^)]+)\)/)?.[1])
    expect((1 - 1 / scale) / 2).toBeGreaterThan(0.17)
  })
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
