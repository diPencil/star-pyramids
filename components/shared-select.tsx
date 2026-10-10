'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Select } from '@base-ui/react/select'
import type { CountryPopupWidth } from '@/components/country-select'
import { tx } from '@/components/locale'
import type { Locale } from '@/lib/locale-config'

export type SharedSelectOption = {
  value: string
  /** Row content. Keep short; rows ellipsis by design. */
  label: ReactNode
  /** Optional compact label for the closed trigger only. */
  selectedLabel?: ReactNode
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
  /**
   * Non-selectable guidance text rendered at the top of the OPEN dropdown only.
   * Never becomes a form value, never appears in the closed trigger, and is
   * excluded from keyboard navigation and typeahead.
   */
  guidance?: ReactNode
  /**
   * Base UI Select modal behavior. `true` locks page scroll while open.
   * Homepage mini-search passes `false` so the page can still scroll.
   * Defaults to `true` to preserve every other instance.
   */
  modal?: boolean
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
  popupWidth?: CountryPopupWidth
  popupAlign?: 'start' | 'center' | 'end'
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
  guidance,
  modal = true,
  disabled,
  invalid,
  describedBy,
  className = '',
  popupWidth = 'content',
  popupAlign,
}: SharedSelectProps) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const dropdownHint = label ?? tx(locale, { en: 'Choose from the list', es: 'Elige de la lista', it: 'Scegli dalla lista', ar: 'اختر من القائمة' })

  // Controlled open state for non-modal selects to enable Escape/outside-click dismissal
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Sync internal open state with Base UI Select's onOpenChange
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

  // Handle Escape key to close dropdown
  useEffect(() => {
    if (!open || modal) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true) // capture phase on window
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, modal])

  // Handle outside click to close dropdown
  useEffect(() => {
    if (!open || modal) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        const popup = document.querySelector('[data-cselect-popup]')
        if (popup && !popup.contains(target)) {
          setOpen(false)
        }
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, modal])

  const handleValueChange = (next: string | null) => {
    onChange(typeof next === 'string' ? next : '')
    if (!modal) {
      setOpen(false)
    }
  }

  return (
    <span dir={dir} className={`cselect${className ? ` ${className}` : ''}`}>
      <Select.Root
        value={value === '' ? null : value}
        onValueChange={handleValueChange}
        disabled={disabled}
        modal={modal}
        onOpenChange={handleOpenChange}
      >
        <Select.Trigger
          ref={triggerRef}
          id={id}
          className={`cselect-trigger${invalid ? ' is-invalid' : ''}`}
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          aria-invalid={invalid === true ? true : undefined}
          aria-describedby={describedBy}
        >
          <Select.Value placeholder={placeholder ?? dropdownHint} className="cselect-value">
            {(current: string | null) => {
              const currentOption = current ? (options.find((option) => option.value === current) ?? null) : null
              if (!currentOption) return placeholder ?? dropdownHint
              return <span className="cselect-current"><span className="cselect-current-name">{currentOption.selectedLabel ?? currentOption.label}</span></span>
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
            align={popupAlign}
            alignItemWithTrigger={false}
            collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            sticky
          >
            <Select.Popup className="cselect-popup" data-popup-width={popupWidth} dir={dir} aria-label={typeof dropdownHint === 'string' ? dropdownHint : undefined} data-cselect-popup>
              {guidance ? (
                <div className="cselect-guidance" aria-hidden="true">
                  <span className="cselect-guidance-text">{guidance}</span>
                </div>
              ) : null}
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
