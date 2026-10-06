'use client'

import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Select } from '@base-ui/react/select'
import type { CountryPopupWidth } from '@/components/country-select'
import { tx } from '@/components/locale'
import type { Locale } from '@/lib/locale-config'

export type SharedSelectOption = {
  value: string
  /** Row content. Keep short; rows ellipsis by design. */
  label: ReactNode
  /** Plain-text label for keyboard typeahead. Defaults to `value`. */
  text?: string
}

type SharedSelectProps = {
  value: string
  onChange: (value: string) => void
  options: readonly SharedSelectOption[]
  locale?: Locale
  id?: string
  /** Explicit accessible name. Omit to inherit a wrapping `<label>`. */
  label?: string
  /** Id of an external visible label. Takes precedence over `label`. */
  labelledBy?: string
  /** Shown when no option is selected. */
  placeholder?: ReactNode
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
  popupWidth?: CountryPopupWidth
}

/**
 * Generic dropdown for non-country selects (status filters, rows-per-page,
 * destinations, tours, …). Same Base UI architecture, popup sizing, and
 * `.cselect-*` design language as CountrySelect — one visual system across
 * Public / Account / Admin. Controlled string value; numeric callers convert
 * in `onChange`, exactly like the native selects this replaces.
 */
export function SharedSelect({
  value,
  onChange,
  options,
  locale = 'en',
  id,
  label,
  labelledBy,
  placeholder,
  disabled,
  invalid,
  describedBy,
  className = '',
  popupWidth = 'content',
}: SharedSelectProps) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const dropdownHint = label ?? tx(locale, { en: 'Choose from the list', es: 'Elige de la lista', it: 'Scegli dalla lista', ar: 'اختر من القائمة' })

  return (
    <span dir={dir} className={`cselect${className ? ` ${className}` : ''}`}>
      <Select.Root
        value={value === '' ? null : value}
        onValueChange={(next) => onChange(typeof next === 'string' ? next : '')}
        disabled={disabled}
      >
        <Select.Trigger
          id={id}
          className={`cselect-trigger${invalid ? ' is-invalid' : ''}`}
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          aria-invalid={invalid === true ? true : undefined}
          aria-describedby={describedBy}
        >
          <Select.Value placeholder={placeholder ?? dropdownHint}>
            {(current: string | null) => {
              const currentOption = current ? (options.find((option) => option.value === current) ?? null) : null
              if (!currentOption) return null
              return <span className="cselect-current"><span className="cselect-current-name">{currentOption.label}</span></span>
            }}
          </Select.Value>
          <Select.Icon aria-hidden="true" className="cselect-chevron">
            <ChevronDown size={15} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          {/* Header-safe collision geometry (shared with CountrySelect): the top
              padding reserves the fixed sticky nav (≈65px) plus a safe gap, so
              the dropdown prefers below, flips above only when necessary, stays
              compact, and never slides underneath the header. `sticky` clamps
              the final placement into the safe viewport on both axes.
              Available height remains a maximum collision limit — short lists
              keep natural height, long lists cap at the CSS 320px viewport with
              internal scroll. */}
          <Select.Positioner
            className="cselect-positioner"
            sideOffset={6}
            alignItemWithTrigger={false}
            collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            sticky
          >
            <Select.Popup className="cselect-popup" data-popup-width={popupWidth} dir={dir} aria-label={typeof dropdownHint === 'string' ? dropdownHint : undefined}>
              <Select.List className="cselect-list">
                {options.map((option) => (
                  <Select.Item
                    key={option.value || 'placeholder'}
                    value={option.value}
                    label={option.text ?? (typeof option.label === 'string' ? option.label : option.value)}
                    className="cselect-item"
                  >
                    <Select.ItemText className="cselect-item-text">
                      <span className="cselect-item-name">{option.label}</span>
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
