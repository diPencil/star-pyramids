import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { expect, it } from 'vitest'
const css = postcss.parse(readFileSync('app/mobile-shell.css', 'utf8'))
it('keeps mobile search outside the sticky header so it scrolls with the page', () => {
  const source = readFileSync('components/site.tsx', 'utf8')
  const headerStart = source.indexOf('<header ref={primaryHeaderRef}')
  const headerEnd = source.indexOf('</header>', headerStart)
  const searchStart = source.indexOf('<form className="mobile-header-search container"')
  expect(headerStart).toBeGreaterThan(-1)
  expect(searchStart).toBeGreaterThan(headerEnd)
})
it('keeps the public mobile and tablet header sticky without changing desktop positioning', () => {
  let found = false
  css.walkRules('.site-header', rule => {
    if (rule.parent?.type !== 'atrule' || (rule.parent as postcss.AtRule).params !== 'screen and (max-width:1024px)') return
    const declarations: Record<string, string> = {}
    rule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value })
    expect(declarations).toMatchObject({ position: 'sticky', top: '0', 'z-index': '45' })
    found = true
  })
  expect(found).toBe(true)
})
function mobileRule(selector: string) {
  let result: Record<string, string> = {}
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return
    if (rule.parent?.type !== 'atrule' || (rule.parent as postcss.AtRule).params !== 'screen and (max-width:760px)') return
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value })
  })
  return result
}
it('hides the mobile header cart without removing desktop cart access', () => {
  expect(mobileRule('.site-header .header-actions .icon-btn.header-cart').display).toBe('none')
  expect(readFileSync('components/site.tsx', 'utf8')).toContain('href="/cart"')
})
it('provides five mobile slots and hides duplicate floating support buttons', () => {
  expect(mobileRule('.mobile-bottom-nav')['grid-template-columns']).toBe('repeat(5,minmax(0,1fr))')
  for (const selector of ['body:has(.mobile-bottom-nav) .livechat-fab', 'body:has(.mobile-bottom-nav) .wa-fab', 'body:has(.mobile-bottom-nav) .livechat-teaser']) {
    expect(mobileRule(selector).display).toBe('none')
  }
  for (const [file, target] of [['components/live-chat.tsx', 'mobile-livechat-trigger'], ['components/whatsapp-chat.tsx', 'mobile-whatsapp-trigger']]) {
    const source = readFileSync(file, 'utf8')
    expect(source).toContain(`document.getElementById('${target}')`)
    expect(source).toContain('createPortal(<button')
    expect(source).toContain('open ? onClose() : openPanel()')
  }
})
it('keeps support and scroll controls fixed above bottom navigation and booking shortcuts', () => {
  for (const selector of ['body:has(.mobile-bottom-nav) .support-widgets', 'body:has(.mobile-bottom-nav) .scroll-top']) {
    expect(mobileRule(selector)).toMatchObject({ position: 'fixed', bottom: 'var(--mobile-floating-bottom)' })
  }
  expect(mobileRule('body:has(.mobile-bottom-nav):has(.mobile-booking-shortcut)')['--mobile-floating-bottom']).toContain('77px')
  expect(mobileRule('body:has(.mobile-bottom-nav) .livechat-teaser').position).toBe('fixed')
})
it('centers the homepage enquiry card without margins exceeding its available width', () => {
  expect(mobileRule('.help-home.container')).toMatchObject({ 'margin-inline': 'auto', width: 'min(calc(100% - 32px),var(--content))', 'min-width': '0' })
})
it('stacks travel timing and uses two equal trip-kind columns only on mobile', () => {
  expect(mobileRule('.home-hero .trip-time-selector')['grid-template-columns']).toBe('minmax(0,1fr)')
  expect(mobileRule('.home-hero .trip-time-selector button').width).toBe('100%')
  expect(mobileRule('.home-hero .trip-kind-options')).toMatchObject({ display: 'grid', 'grid-template-columns': 'repeat(2,minmax(0,1fr))', width: '100%' })
  expect(mobileRule('.home-hero .trip-kind-options .trip-kind-btn')).toMatchObject({ width: '100%', height: '100%', 'min-width': '0' })
})
