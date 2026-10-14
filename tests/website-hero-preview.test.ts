import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { originalHomeHero, readHeroPreviewMessage } from '@/lib/website-heroes'

const origin = 'https://example.com'
const parent = {} as Window
const valid = () => ({ origin, source: parent, data: { type: 'star-hero-preview', content: originalHomeHero(), locale: 'it' } })

describe('protected live homepage preview', () => {
  it('accepts validated localized content from the same-origin parent only', () => {
    expect(readHeroPreviewMessage(valid(), origin, parent, true)).toEqual({ content: originalHomeHero(), locale: 'it' })
  })
  it('rejects cross-origin messages', () => {
    expect(readHeroPreviewMessage({ ...valid(), origin: 'https://other.example' }, origin, parent, true)).toBeNull()
  })
  it('rejects other same-origin windows and standalone pages', () => {
    expect(readHeroPreviewMessage({ ...valid(), source: {} as Window }, origin, parent, true)).toBeNull()
    expect(readHeroPreviewMessage(valid(), origin, parent, false)).toBeNull()
  })
  it('rejects invalid media, incomplete content and disabled locales', () => {
    for (const data of [null, { ...valid().data, locale: 'ar' }, { ...valid().data, content: {} }, { ...valid().data, content: { ...originalHomeHero(), mediaUrl: 'javascript:alert(1)' } }]) {
      expect(readHeroPreviewMessage({ ...valid(), data }, origin, parent, true)).toBeNull()
    }
  })
  it('keeps real homepage search inert and avoids draft writes for preview', () => {
    const preview = readFileSync('components/homepage-hero-preview.tsx', 'utf8')
    expect(preview).toContain('<div inert><RebuiltHomePage')
    expect(preview).not.toMatch(/fetch\(|localStorage|sessionStorage/)
    expect(preview).toContain("type: 'star-hero-preview-ready'")
    const editor = readFileSync('app/admin/website-cms/hero-sections/homepage/page.tsx', 'utf8')
    expect(editor).toContain('event.source === liveFrame.current?.contentWindow')
    expect(editor).toContain("className={'cms-hero-frame ' + width}")
    expect(editor).toContain("disabled={disabled || dirty || state?.mode !== 'published'}")
    expect(editor).not.toContain('<select')
  })
})
