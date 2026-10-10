import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({ locale: 'es', pathname: '/rent-car' }))
vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: context.locale }) }))
vi.mock('next/navigation', () => ({ usePathname: () => context.pathname }))

import { useCatalogueLanguage } from '@/lib/use-catalogue-language'
import { ContentLanguageTabs, TranslatedInput } from '@/components/admin/content-language-tabs'

describe('catalogue language consumers', () => {
  const source = { slug: 'vehicle', title: 'Vehicle', copy: 'English', dailyPrice: 45, translations: { es: { title: 'Vehículo' } } }
  function readRows() {
    let result: (typeof source)[] = []
    function Probe() { result = useCatalogueLanguage([source], 'car'); return null }
    renderToStaticMarkup(createElement(Probe))
    return result
  }

  it('renders Spanish content publicly while retaining numeric values', () => {
    context.pathname = '/rent-car'
    context.locale = 'es'
    expect(readRows()[0]).toMatchObject({ title: 'Vehículo', dailyPrice: 45 })
    expect(source.title).toBe('Vehicle')
  })

  it('never localizes canonical admin records even when the visitor language is Spanish', () => {
    context.pathname = '/admin/cars/new'
    context.locale = 'es'
    expect(readRows()[0]).toBe(source)
  })

  it('falls back to English in a language with no translation', () => {
    context.pathname = '/rent-car'
    context.locale = 'it'
    expect(readRows()[0].title).toBe('Vehicle')
  })

  it('renders three enabled tabs and only one shared price input', () => {
    const markup = renderToStaticMarkup(createElement(ContentLanguageTabs, {
      translations: source.translations,
      setTranslations: () => {},
      children: [
        createElement(TranslatedInput, { key: 'title', field: 'title', value: source.title, onChange: () => {} }),
        createElement('input', { key: 'price', name: 'shared-price', value: 45, readOnly: true }),
      ],
    }))
    expect(markup.match(/role="tab"/g)).toHaveLength(3)
    expect(markup.match(/name="shared-price"/g)).toHaveLength(1)
    expect(markup).toContain('Español')
    expect(markup).toContain('Italiano')
    expect(markup).not.toContain('العربية')
  })
})
