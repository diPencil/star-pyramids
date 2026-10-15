import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { expect, it } from 'vitest'
it('keeps dashboard actions beside welcome copy on desktop without changing other headers or mobile', () => {
  const root = postcss.parse(readFileSync('app/admin/admin.css', 'utf8'))
  const rules: Record<string, Record<string, string>> = {}
  root.walkAtRules('media', media => {
    if (media.params !== '(min-width: 1100px)') return
    media.walkRules(rule => {
      if (!rule.selector.includes('.sp-dashboard-range-trigger')) return
      rules[rule.selector] = {}
      rule.walkDecls(decl => { rules[rule.selector][decl.prop] = decl.value })
    })
  })
  expect(rules['.sp-pagehead:has(.sp-dashboard-range-trigger)']).toEqual({ 'flex-wrap': 'nowrap' })
  expect(rules['.sp-pagehead:has(.sp-dashboard-range-trigger) .sp-pagehead-title-row']).toEqual({ flex: '1 1 0' })
  expect(rules['.sp-pagehead-actions:has(.sp-dashboard-range-trigger)']).toEqual({ flex: '0 0 auto' })
})
