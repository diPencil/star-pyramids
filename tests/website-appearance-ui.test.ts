import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const source = (file: string) => readFileSync(file, 'utf8')
describe('appearance ownership and public-only integration contracts', () => {
  it('removes legacy duplicate editors without deleting their storage contracts', () => {
    const settings = source('app/admin/settings/page.tsx')
    expect(settings).toContain("en: 'Website Appearance'")
    const appearance = source('components/admin/website-appearance.tsx')
    expect(appearance).not.toContain('href="/admin/website-cms/seo"')
    expect(appearance).not.toContain('href="/admin/offers"')
    expect(settings).not.toContain("'site.seoTitle'"); expect(settings).not.toContain("'site.promoText'"); expect(settings).not.toContain("'site.accessStrip'")
    expect(source('components/admin/seo-global-settings.tsx')).toContain("'site.seoTitle'")
    expect(source('lib/server/settings.ts')).toContain("'site.seoTitle'")
    expect(source('lib/server/settings.ts')).toContain("'site.promoText'")
  })
  it('reads only published appearance at the public boundary and excludes private shells', () => {
    expect(source('app/layout.tsx')).toContain('tokens={await readPublishedAppearance()}')
    expect(source('components/public-appearance.tsx')).toContain('isPublicAppearancePath')
    expect(source('components/public-appearance.tsx')).not.toContain('tokens.draft')
    expect(source('components/language-selector.tsx')).toContain('PublicAppearancePortal')
    expect(source('components/reviews.tsx')).toContain('PublicAppearancePortal')
  })
  it('uses sandboxed local previews, all viewports, save guards and existing custom dialogs', () => {
    const ui = source('components/admin/website-appearance.tsx')
    expect(ui).toContain('sandbox=""'); expect(ui).toContain('srcDoc={preview}')
    for (const device of ['desktop', 'tablet', 'mobile']) expect(ui).toContain(device)
    expect(ui).toContain('protectEnquiryNavigation'); expect(ui).toContain('AdminConfirmDialog'); expect(ui).toContain('busyRef.current')
    expect(ui).not.toMatch(/window\.alert|window\.confirm|dangerouslySetInnerHTML/)
    expect(source('app/admin/settings/page.tsx')).toContain('canConfirm={!appearanceBusy}')
  })
})
