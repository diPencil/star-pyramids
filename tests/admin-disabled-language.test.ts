import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminText } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { ENABLED_LOCALES, isLocaleEnabled } from '@/lib/locale-config'

afterEach(() => vi.unstubAllGlobals())
describe('disabled Arabic cannot leak through admin display styles or old preferences', () => {
  it('does not emit the Arabic text node in builder coverage cards', () => {
    const html = renderToStaticMarkup(createElement('div', { className: 'sp-builder-coverage' },
      createElement('span', null, createElement('b', null, 0), createElement(AdminText, { en: 'journey videos', ar: 'فيديوهات رحلة' }))))
    expect(html).toContain('journey videos')
    expect(html).not.toContain('فيديوهات')
    expect(html).not.toContain('sp-l10n-ar')
  })
  it.each(['ar', 'en', 'es', 'it'])('keeps legacy admin chrome English for stored %s while EN/ES/IT content languages remain enabled', locale => {
    vi.stubGlobal('window', { localStorage: { getItem: () => locale } })
    expect(useAdminLocale()).toBe('en')
    expect(ENABLED_LOCALES).toEqual(['en', 'es', 'it'])
    expect(isLocaleEnabled('ar')).toBe(false)
  })
})
