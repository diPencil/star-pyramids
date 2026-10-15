import { describe, expect, it } from 'vitest'
import { APPEARANCE_FIELDS, appearanceCss, contrastRatio, decodeAppearance, initialAppearance, isPublicAppearancePath, transitionAppearance, validateAppearance, type AppearanceToken } from '@/lib/website-appearance'

describe('public appearance token contracts', () => {
  it('leaves every original component unchanged without explicit overrides', () => {
    expect(appearanceCss({})).toBe('')
    expect(initialAppearance().published).toBeNull()
  })
  it.each(Object.entries(APPEARANCE_FIELDS))('validates and consumes %s', (key, field) => {
    const value = field.kind === 'select' && key === 'cardShadow' ? 'soft' : field.default
    expect(validateAppearance({ [key]: value })).toEqual({ [key]: value })
    expect(appearanceCss({ [key as AppearanceToken]: value })).not.toBe('')
  })
  it.each([
    { primary: 'red' }, { primary: '#fff' }, { primary: '#fff;}</style><script>alert(1)</script>' },
    { font: 'https://bad.example/font.css' }, { font: 'url(javascript:alert(1))' }, { cardShadow: '0 0 5px red' },
    { baseSize: 100 }, { inputHeight: 1 }, { containerWidth: 99999 }, { headingWeight: 550 }, { lineHeight: Infinity },
    { breakpoints: '100px' }, { 'site.seoTitle': 'Changed' }, { 'site.promoText': 'Changed' }, { colorScheme: 'dark' },
  ])('rejects unsupported or unsafe values: %j', input => { expect(() => validateAppearance(input)).toThrow() })
  it('rejects prototype keys and malformed data', () => {
    expect(() => validateAppearance(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow()
    expect(() => validateAppearance(null)).toThrow()
    expect(() => decodeAppearance('{"version":2}')).toThrow()
    expect(() => decodeAppearance(JSON.stringify({ ...initialAppearance(), published: { primary: 'bad' } }))).toThrow()
    expect(() => appearanceCss({}, 'body')).toThrow()
  })
  it('preserves independent drafts, publish and previous-version restore', () => {
    const initial = initialAppearance()
    const draft = transitionAppearance(initial, 'save-draft', { primary: '#112233' })
    expect(draft.published).toBeNull()
    const first = transitionAppearance(draft, 'publish')
    expect(first.draft).toBeNull(); expect(first.published).toEqual({ primary: '#112233' })
    const editing = transitionAppearance(first, 'save-draft', { primary: '#445566' })
    expect(editing.published).toEqual(first.published)
    const second = transitionAppearance(editing, 'publish')
    expect(second.previous).toEqual(first.published)
    const restored = transitionAppearance(second, 'restore')
    expect(restored.published).toEqual(first.published); expect(restored.draft).toBeNull()
    expect(transitionAppearance(first, 'restore').published).toBeNull()
    expect(initial).toEqual(initialAppearance())
    expect(decodeAppearance(JSON.stringify(second))).toEqual(second)
  })
  it('requires a saved draft and refuses a nonexistent previous publication', () => {
    expect(() => transitionAppearance(initialAppearance(), 'publish')).toThrow()
    expect(() => transitionAppearance(initialAppearance(), 'restore')).toThrow()
  })
  it('keeps deliberate empty overrides authoritative', () => {
    const published = transitionAppearance(transitionAppearance(initialAppearance(), 'save-draft', {}), 'publish')
    expect(published.published).toEqual({})
    expect(appearanceCss(published.published!)).toBe('')
  })
  it('scopes selectors, responsive settings and font choices without admin selectors', () => {
    const css = appearanceCss({ primary: '#123456', h1: 60, mobileHeadingScale: 0.75, tabletBaseSize: 18, inputRadius: 12, buttonHeight: 52, font: 'system', gridGap: 20 })
    expect(css).toContain('.public-appearance{--primary:#123456')
    expect(css).toContain('@media (max-width:760px)')
    expect(css).toContain('font-size:45px')
    expect(css).toContain('.public-appearance .form-grid input')
    expect(css).toContain('.public-appearance .primary-btn')
    expect(css).not.toMatch(/\.sp-|\.admin|:root|@import|https?:/)
  })
  it.each(['/admin', '/admin/settings', '/account', '/account/bookings'])('excludes private shell %s', path => { expect(isPublicAppearancePath(path)).toBe(false) })
  it.each(['/', '/blogs/travel', '/egypt-tours/test', '/contact', '/administrator'])('includes public route %s', path => { expect(isPublicAppearancePath(path)).toBe(true) })
  it('calculates accessible contrast without rewriting brand colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#ffffff', '#f7951d')).toBeLessThan(4.5)
  })
  it('connects actual homepage grids, promotional cards and help fields while protecting non-text inputs', () => {
    const css = appearanceCss({ gridGap: 20, sectionSpacing: 64, cardRadius: 12, inputHeight: 56, placeholder: '#667788' })
    for (const selector of ['.compact-tour-grid', '.blog-home-grid', '.home-section', '.offer-card', '.shared-help-fields', '.ask-form', '.rev-form']) expect(css).toContain(selector)
    expect(css).toContain(':not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])')
    expect(css).toContain('min-height:max(96px,56px)')
  })
})
