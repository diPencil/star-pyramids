'use client'

import { Check, ChevronDown } from 'lucide-react'
import { Select } from '@base-ui/react/select'
import { countries, type CountryOption } from '@/data/countries'
import { CountryFlag } from '@/components/country-flag'
import { tx } from '@/components/locale'
import type { Locale } from '@/lib/locale-config'

export type CountrySelectVariant = 'country' | 'phone'

/**
 * Popup sizing strategy (see the dropdown design system in globals.css):
 * - `content` (default): compact floating menu sized to its content, capped
 *   well below wide triggers — never a giant full-field panel.
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

function localizedName(country: CountryOption, locale: Locale): string {
  return locale === 'ar' ? country.nameAr : country.name
}

/**
 * Shared country picker for the trip-request surfaces.
 *
 * Why not a native `<select>`: the phone control needs a compact collapsed
 * label (flag + dial) with rich dropdown rows (name + dial), which a native
 * select cannot render, and QA found 197-option native popups opening far
 * from their field. This wraps the project's existing Base UI Select
 * primitive (already a dependency, already used by `components/ui`):
 * anchored popup, sensible max-height with internal scroll, typeahead,
 * full keyboard support, Escape/outside-press close, and ARIA listbox
 * semantics — without adding any dependency or touching country data.
 */
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
  const effective = selected

  const triggerName = labelledBy ? undefined : label
  const dropdownHint = tx(locale, { en: 'Choose a country', es: 'Elige un país', it: 'Scegli un paese', ar: 'اختر الدولة' })

  return (
    <span dir={dir} className={`cselect${variant === 'phone' ? ' is-phone' : ''}${className ? ` ${className}` : ''}`}>
      <Select.Root
        value={value === '' ? null : value}
        onValueChange={(next) => onChange(typeof next === 'string' ? next : '')}
        disabled={disabled}
      >
        <Select.Trigger
          id={id}
          className={`cselect-trigger${invalid ? ' is-invalid' : ''}`}
          aria-label={triggerName}
          aria-labelledby={labelledBy}
          aria-invalid={invalid === true ? true : undefined}
          aria-describedby={describedBy}
          title={effective ? `${localizedName(effective, locale)} (${effective.dialCode})` : dropdownHint}
        >
          <Select.Value placeholder={variant === 'phone' ? '' : (placeholder ?? dropdownHint)} className="cselect-value">
            {(current: string | null) => {
              const currentCountry = current ? (countries.find((country) => country.code === current) ?? null) : null
              if (!currentCountry) return null
              return variant === 'phone' ? (
                <span className="cselect-compact">
                  <CountryFlag code={currentCountry.code} size={18} />
                  <bdi dir="ltr">{currentCountry.dialCode}</bdi>
                </span>
              ) : (
                <span className="cselect-current">
                  <CountryFlag code={currentCountry.code} size={18} />
                  <span className="cselect-current-name">{localizedName(currentCountry, locale)}</span>
                </span>
              )
            }}
          </Select.Value>
          <Select.Icon aria-hidden="true" className="cselect-chevron">
            <ChevronDown size={15} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          {/* Same header-safe collision geometry as SharedSelect (see above):
              top padding reserves the fixed sticky nav plus a safe gap;
              available height stays a maximum limit, not the desired height. */}
          <Select.Positioner
            className="cselect-positioner"
            sideOffset={6}
            alignItemWithTrigger={false}
            collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            sticky
          >
            <Select.Popup className="cselect-popup" data-popup-width={popupWidth} dir={dir} aria-label={dropdownHint}>
              <Select.List className="cselect-list">
                {countries.map((country) => (
                  <Select.Item
                    key={country.code}
                    value={country.code}
                    label={localizedName(country, locale)}
                    className="cselect-item"
                  >
                    <Select.ItemText className="cselect-item-text">
                      {variant === 'phone' && <CountryFlag code={country.code} size={18} />}
                      {variant === 'country' && <CountryFlag code={country.code} size={18} />}
                      <span className="cselect-item-name">{localizedName(country, locale)}</span>
                      {variant === 'phone' && <bdi dir="ltr" className="cselect-item-dial">{country.dialCode}</bdi>}
                    </Select.ItemText>
                    <Select.ItemIndicator className="cselect-check" aria-hidden="true">
                      <Check size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </span>
  )
}
