'use client'

import { Check, ChevronDown } from 'lucide-react'
import { Combobox } from '@base-ui/react/combobox'
import { countries, type CountryOption } from '@/data/countries'
import { countryLabel as localizedName } from '@/lib/i18n/country-label'
import { CountryFlag } from '@/components/shared/forms/country-flag'
import { tx } from '@/components/locale'
import type { Locale } from '@/lib/i18n/locale-config'

export type CountrySelectVariant = 'country' | 'phone'

/**
 * Popup sizing strategy (see the dropdown design system in globals.css):
 * - `content` (default): compact floating menu sized to its content, capped
 *   well below wide triggers  -  never a giant full-field panel.
 * - `trigger`: popup matches the trigger width for genuinely long content.
 */
export type CountryPopupWidth = 'content' | 'trigger'

type CountrySelectProps = {
  /** Canonical ISO country code. '' renders the placeholder. */
  value: string
  onChange: (code: string) => void
  locale?: Locale
  /**
   * - `country`: trigger shows flag + country name (nationality / country-only fields).
   * - `phone`: trigger shows flag + dial code only; the dropdown keeps full names.
   */
  variant?: CountrySelectVariant
  id?: string
  /** Explicit accessible name. Omit to inherit a wrapping `<label>`. */
  label?: string
  /** Id of an external visible label. Takes precedence over `label`. */
  labelledBy?: string
  /** Shown when no country is selected (country variant). */
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
  popupWidth?: CountryPopupWidth
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

function matchesCountry(country: CountryOption, query: string, locale: Locale) {
  const term = normalizeName(query)
  const dial = term.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[\s()-]/g, '')
  if (/^\+?\d+$/.test(dial)) return country.dialCode.slice(1).startsWith(dial.replace(/^\+/, ''))
  return country.code.toLowerCase() === term ||
    [localizedName(country, locale), country.name, country.nameAr].some(name => normalizeName(name).includes(term))
}

/** Shared country picker that filters its anchored popup from the visible field. */
export function CountrySelect({
  value,
  onChange,
  locale = 'en',
  variant = 'country',
  id,
  label,
  labelledBy,
  placeholder,
  disabled,
  invalid,
  describedBy,
  className = '',
  popupWidth = 'content',
}: CountrySelectProps) {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const selected = value ? (countries.find((country) => country.code === value) ?? null) : null
  const triggerName = labelledBy ? undefined : label
  const dropdownHint = tx(locale, { en: 'Choose a country', es: 'Elige un país', it: 'Scegli un paese', ar: 'اختر الدولة' })
  const searchLabel = tx(locale, { en: 'Search by country or calling code', es: 'Busca por país o prefijo', it: 'Cerca per paese o prefisso', ar: 'ابحث باسم الدولة أو كود الاتصال' })
  const inputLabel = (country: CountryOption) => variant === 'phone' ? country.dialCode : localizedName(country, locale)

  return (
    <span dir={dir} className={`cselect${variant === 'phone' ? ' is-phone' : ''}${className ? ` ${className}` : ''}`}>
      <Combobox.Root
        key={locale}
        items={countries}
        value={selected}
        onValueChange={(next) => { if (next) onChange(next.code) }}
        itemToStringLabel={inputLabel}
        filter={(country, query) => matchesCountry(country, query, locale)}
        autoHighlight
        openOnInputClick
        disabled={disabled}
      >
        <Combobox.InputGroup render={<span />} className={`cselect-trigger cselect-editable${invalid ? ' is-invalid' : ''}`}>
          {selected && <CountryFlag code={selected.code} size={18} />}
          <Combobox.Input
            id={id}
            className="cselect-inline-input"
            aria-label={triggerName}
            aria-labelledby={labelledBy}
            aria-invalid={invalid === true ? true : undefined}
            aria-describedby={describedBy}
            title={selected ? `${localizedName(selected, locale)} (${selected.dialCode})` : dropdownHint}
            placeholder={variant === 'phone' ? undefined : (placeholder ?? dropdownHint)}
            autoComplete="off"
            onClick={(event) => { if (selected && event.currentTarget.value === inputLabel(selected)) event.currentTarget.select() }}
            onFocus={(event) => { if (selected && event.currentTarget.value === inputLabel(selected)) event.currentTarget.select() }}
          />
          <Combobox.Trigger className="cselect-chevron cselect-toggle" aria-label={searchLabel} tabIndex={-1}>
            <ChevronDown size={15} />
          </Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          {/* Same header-safe collision geometry as SharedSelect (see above):
              top padding reserves the fixed sticky nav plus a safe gap;
              available height stays a maximum limit, not the desired height. */}
          <Combobox.Positioner
            className="cselect-positioner"
            sideOffset={6}
            collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            sticky
          >
            <Combobox.Popup className="cselect-popup cselect-search-popup" data-popup-width={popupWidth} dir={dir}>
              <Combobox.Empty className="cselect-search-empty">{tx(locale, { en: 'No countries found', es: 'No se encontraron países', it: 'Nessun paese trovato', ar: 'لا توجد دول مطابقة' })}</Combobox.Empty>
              <Combobox.List className="cselect-list">
                {(country: CountryOption) => (
                  <Combobox.Item
                    key={country.code}
                    value={country}
                    className="cselect-item"
                  >
                    <span className="cselect-item-text">
                      <CountryFlag code={country.code} size={18} />
                      <span className="cselect-item-name">{localizedName(country, locale)}</span>
                      {variant === 'phone' && <bdi dir="ltr" className="cselect-item-dial">{country.dialCode}</bdi>}
                    </span>
                    <Combobox.ItemIndicator className="cselect-check" aria-hidden="true">
                      <Check size={14} />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </span>
  )
}
