import { Combobox } from '@base-ui/react/combobox'
import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CountrySelect } from '@/components/shared/forms/country-select'
import { countries, countryByCode, type CountryOption } from '@/data/countries'
import type { Locale } from '@/lib/i18n/locale-config'

function picker(locale: Locale = 'en', variant: 'country' | 'phone' = 'country') {
  const onChange = vi.fn()
  const element = CountrySelect({ value: 'AF', locale, variant, onChange })
  const [root] = Children.toArray(element.props.children as ReactNode)
  if (!isValidElement<{
    filter: (country: CountryOption, query: string) => boolean
    onValueChange: (value: CountryOption | null) => void
  }>(root) || root.type !== Combobox.Root) throw new Error('Expected country combobox')
  return { ...root.props, onChange }
}

it.each([['en', 'مصر'], ['en', '  EGYPT '], ['es', 'Egipto'], ['it', 'Egitto'], ['en', 'EG'], ['en', '+20'], ['en', '٢٠']] as const)(
  'finds Egypt by %s search %s in both dropdowns', (locale, query) => {
    for (const variant of ['country', 'phone'] as const) {
      const { filter, onChange } = picker(locale, variant)
      expect(countries.filter(country => filter(country, query)).map(country => country.code)).toContain('EG')
      expect(filter(countryByCode('AF'), query)).toBe(false)
      expect(onChange).not.toHaveBeenCalled()
    }
  },
)

it('keeps the current country until a result is selected', () => {
  const { filter, onValueChange, onChange } = picker()
  expect(countries.filter(country => filter(country, 'zzzzz'))).toEqual([])
  onValueChange(null)
  expect(onChange).not.toHaveBeenCalled()
  onValueChange(countryByCode('EG'))
  expect(onChange).toHaveBeenCalledExactlyOnceWith('EG')
})

it('renders editable country and calling-code inputs in the field before the popup opens', () => {
  const country = renderToStaticMarkup(createElement(CountrySelect, { value: '', onChange: vi.fn() }))
  const phone = renderToStaticMarkup(createElement(CountrySelect, { value: 'EG', onChange: vi.fn(), variant: 'phone', disabled: true }))
  expect(country).toContain('Choose a country')
  expect(country).toContain('type="button"')
  expect(country).toMatch(/<input[^>]*class="cselect-inline-input"/)
  expect(phone).toMatch(/<input[^>]*class="cselect-inline-input"[^>]*value="\+20"/)
  expect(phone).toContain('disabled')
})
