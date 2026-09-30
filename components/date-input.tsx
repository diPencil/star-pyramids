'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from 'react'
import { Popover } from '@base-ui/react/popover'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale } from '@/components/locale'
import {
  clampViewMonth,
  compareMonth,
  displayFor,
  fullDateLabel,
  initialViewMonth,
  monthLabel,
  parseYMD,
  todayYMD,
  toISO,
  toKey,
  WEEKDAY_NAMES,
  type YMD,
} from '@/lib/date-calendar'

/**
 * Shared STAR PYRAMIDS date field.
 *
 * Custom calendar popover — no native `type="date"` UI, no `showPicker()`.
 * The visible control stays a read-only text input (so every existing `input`
 * selector in the design system keeps matching and wrapping `<label>` elements
 * keep naming the field), while the FORM VALUE contract is unchanged:
 * controlled/uncontrolled `YYYY-MM-DD` strings via a synthetic `onChange`
 * whose `target.value` carries the ISO date. Display text is a fixed
 * `DD/MM/YYYY` closed-field value (`01/10/2026`, Arabic-Indic digits in `ar`)
 * and never leaks into state.
 *
 * All calendar-date math is timezone-safe integer math on `{ y, m, d }`;
 * `new Date('YYYY-MM-DD')` (UTC-midnight parsing) is never used.
 */

type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  value?: string
  defaultValue?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  /** Legacy no-op: the native indicator no longer exists. Kept for API compat. */
  hideNativeIndicator?: boolean
  /** Legacy no-op: placeholder renders natively on the text field. Kept for API compat. */
  placeholderMode?: boolean
}

function synthesizeChange(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>
}

/** Locale resolved from the site provider; falls back to persisted/admin signals. No new source of truth. */
function useDateLocale(): 'en' | 'ar' {
  const { locale } = useLocale()
  const [externalAr, setExternalAr] = useState(false)
  useEffect(() => {
    const sync = () => {
      try {
        setExternalAr(
          window.localStorage.getItem('star-locale') === 'ar' || document.documentElement.dir === 'rtl',
        )
      } catch {
        setExternalAr(document.documentElement.dir === 'rtl')
      }
    }
    sync()
    window.addEventListener('sp-admin-locale', sync)
    window.addEventListener('storage', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang'] })
    return () => {
      window.removeEventListener('sp-admin-locale', sync)
      window.removeEventListener('storage', sync)
      observer.disconnect()
    }
  }, [])
  return locale === 'ar' || externalAr ? 'ar' : 'en'
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  {
    className,
    hideNativeIndicator: _hideNativeIndicator,
    placeholderMode: _placeholderMode,
    value: valueProp,
    defaultValue,
    onChange,
    min,
    max,
    required,
    disabled,
    readOnly,
    dir,
    id,
    placeholder,
    style,
    ...ariaProps
  },
  forwardedRef,
) {
  const resolvedLocale = useDateLocale()
  const ar = resolvedLocale === 'ar'
  const popupId = useId()
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const minPart = useMemo(() => parseYMD(min), [min])
  const maxPart = useMemo(() => parseYMD(max), [max])

  const controlled = valueProp !== undefined
  const [innerValue, setInnerValue] = useState(() => {
    const parsed = parseYMD(defaultValue)
    return parsed ? toISO(parsed) : ''
  })
  const rawValue = controlled ? valueProp : innerValue
  const selected = parseYMD(rawValue)
  const selectedISO = selected ? toISO(selected) : ''

  const [view, setView] = useState(() => initialViewMonth(rawValue, minPart, maxPart))
  const [focusKey, setFocusKey] = useState<string | null>(null)

  // Opening never auto-selects: the form value is untouched until the user picks a day.
  // The visible month simply follows the current value (or a clamped today).
  useEffect(() => {
    if (open) {
      setView(initialViewMonth(rawValue, minPart, maxPart))
      setFocusKey(null)
    }
  }, [open, rawValue, minPart, maxPart])

  const interactive = !disabled && !readOnly

  const emit = (iso: string) => {
    if (!controlled) setInnerValue(iso)
    onChange?.(synthesizeChange(iso))
  }

  const handleSelect = (iso: string) => {
    emit(iso)
    setOpen(false)
  }

  const handleClear = () => {
    emit('')
    setOpen(false)
  }

  const isDisabledDay = (key: number): boolean => {
    if (minPart && key < toKey(minPart)) return true
    if (maxPart && key > toKey(maxPart)) return true
    return false
  }

  const canGoPrev = !minPart || compareMonth(view, { y: minPart.y, m: minPart.m }) > 0
  const canGoNext = !maxPart || compareMonth(view, { y: maxPart.y, m: maxPart.m }) < 0

  const moveView = (delta: number) => {
    setView((current) => {
      const total = current.y * 12 + (current.m - 1) + delta
      const next = { y: Math.floor(total / 12), m: (total % 12) + 1 }
      return clampViewMonth(next, minPart, maxPart)
    })
  }

  // Fixed 6-week grid: stable popover height, no layout shift between months.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1)
    const lead = first.getDay() // 0 = Sunday
    const start = new Date(view.y, view.m - 1, 1 - lead)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const part: YMD = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }
      return { part, iso: toISO(part), key: toKey(part), inMonth: part.m === view.m }
    })
  }, [view])

  const todayKey = useMemo(() => toKey(todayYMD()), [open])

  const focusDay = (iso: string) => {
    setFocusKey(iso)
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${iso}"]`)?.focus()
    })
  }

  const stepDay = (fromISO: string, delta: number) => {
    const from = parseYMD(fromISO)
    if (!from) return
    const base = new Date(from.y, from.m - 1, from.d)
    base.setDate(base.getDate() + delta)
    const next: YMD = { y: base.getFullYear(), m: base.getMonth() + 1, d: base.getDate() }
    const nextKey = toKey(next)
    if (isDisabledDay(nextKey)) {
      // Land on the nearest enabled day in the step direction (bounded search).
      for (let i = 2; i <= 14; i++) {
        const probe = new Date(from.y, from.m - 1, from.d)
        probe.setDate(probe.getDate() + delta * i)
        const candidate: YMD = { y: probe.getFullYear(), m: probe.getMonth() + 1, d: probe.getDate() }
        if (!isDisabledDay(toKey(candidate))) {
          setView({ y: candidate.y, m: candidate.m })
          focusDay(toISO(candidate))
          return
        }
      }
      return
    }
    if (next.m !== view.m || next.y !== view.y) setView({ y: next.y, m: next.m })
    focusDay(toISO(next))
  }

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const active = document.activeElement
    if (!(active instanceof HTMLButtonElement)) return
    const iso = active.getAttribute('data-day')
    if (!iso) return
    const rtl = ar
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        stepDay(iso, rtl ? 1 : -1)
        break
      case 'ArrowRight':
        event.preventDefault()
        stepDay(iso, rtl ? -1 : 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        stepDay(iso, -7)
        break
      case 'ArrowDown':
        event.preventDefault()
        stepDay(iso, 7)
        break
      case 'Home': {
        event.preventDefault()
        const from = parseYMD(iso)
        if (from) stepDay(iso, -new Date(from.y, from.m - 1, from.d).getDay())
        break
      }
      case 'End': {
        event.preventDefault()
        const from = parseYMD(iso)
        if (from) stepDay(iso, 6 - new Date(from.y, from.m - 1, from.d).getDay())
        break
      }
      case 'PageUp':
        event.preventDefault()
        moveView(event.shiftKey ? -12 : -1)
        break
      case 'PageDown':
        event.preventDefault()
        moveView(event.shiftKey ? 12 : 1)
        break
      default:
        break
    }
  }

  const defaultFocusKey = selectedISO || (cells.some((c) => c.key === todayKey && !isDisabledDay(c.key)) ? toISO(todayYMD()) : null)

  const showClear = selectedISO !== '' && !required && interactive
  const PrevIcon = ar ? ChevronRight : ChevronLeft
  const NextIcon = ar ? ChevronLeft : ChevronRight

  const fieldClasses = ['native-date-input', 'sp-date-field', className ?? ''].filter(Boolean).join(' ')
  // Base UI types Trigger props for its default `<button>`; at runtime it
  // merges these onto our read-only `<input>` via the `render` prop instead.
  const triggerFieldProps = {
    id,
    className: fieldClasses,
    style,
    placeholder,
    value: selectedISO ? displayFor(selectedISO, resolvedLocale) : '',
    disabled,
    'aria-readonly': readOnly || undefined,
    'aria-required': required || undefined,
    ...ariaProps,
  } as unknown as Record<string, unknown>

  return (
    <span className="sp-date-wrap" dir={dir}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (!interactive && next) return
          setOpen(next)
        }}
      >
        <Popover.Trigger
          // The rendered node is the input, so the public ref stays HTMLInputElement.
          ref={forwardedRef as unknown as Ref<HTMLButtonElement>}
          nativeButton={false}
          render={<input type="text" readOnly />}
          {...triggerFieldProps}
        />
        <span className="sp-date-icon" aria-hidden="true">
          <CalendarDays size={17} />
        </span>
        <Popover.Portal>
          <Popover.Positioner
            className="cdate-positioner"
            side="bottom"
            align="start"
            sideOffset={6}
            // Reserve the fixed sticky nav (≈65px) plus a safe visual gap so the
            // calendar prefers below, flips above only when it fully fits there,
            // and never slides underneath the header. `align: flip` keeps the
            // flip-then-shift middleware order so the final placement is always
            // clamped back into the safe viewport; `fallbackAxisSide: none`
            // keeps it a compact top/bottom calendar. `sticky` additionally
            // clamps the popup on the side axis (vertical) into the viewport.
            collisionPadding={{ top: 80, right: 12, bottom: 12, left: 12 }}
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            sticky
          >
            <Popover.Popup
              className="sp-date-popup"
              id={popupId}
              aria-label={ar ? 'اختر التاريخ' : 'Choose date'}
            >
              <div className="sp-date-head">
                <button
                  type="button"
                  className="sp-date-nav"
                  onClick={() => moveView(-1)}
                  disabled={!canGoPrev}
                  aria-label={ar ? 'الشهر السابق' : 'Previous month'}
                >
                  <PrevIcon size={16} />
                </button>
                <strong aria-live="polite">{monthLabel(view, resolvedLocale)}</strong>
                <button
                  type="button"
                  className="sp-date-nav"
                  onClick={() => moveView(1)}
                  disabled={!canGoNext}
                  aria-label={ar ? 'الشهر التالي' : 'Next month'}
                >
                  <NextIcon size={16} />
                </button>
              </div>
              <div className="sp-date-week" aria-hidden="true">
                {WEEKDAY_NAMES[resolvedLocale].map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
              <div ref={gridRef} className="sp-date-grid" role="group" aria-label={monthLabel(view, resolvedLocale)} onKeyDown={handleGridKeyDown}>
                {cells.map((cell) => {
                  const disabledDay = isDisabledDay(cell.key)
                  const isSelected = cell.iso === selectedISO
                  const isToday = cell.key === todayKey
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      data-day={cell.iso}
                      disabled={disabledDay}
                      aria-label={fullDateLabel(cell.iso, resolvedLocale)}
                      aria-pressed={isSelected}
                      aria-current={isToday && !isSelected ? 'date' : undefined}
                      tabIndex={(focusKey ?? defaultFocusKey) === cell.iso || ((focusKey ?? defaultFocusKey) === null && cell.iso === cells.find((c) => !isDisabledDay(c.key))?.iso) ? 0 : -1}
                      className={[
                        'sp-date-day',
                        cell.inMonth ? '' : 'is-outside',
                        isSelected ? 'is-selected' : '',
                        isToday ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelect(cell.iso)}
                      onFocus={() => setFocusKey(cell.iso)}
                    >
                      <span>{cell.part.d}</span>
                    </button>
                  )
                })}
              </div>
              <div className="sp-date-foot">
                <button type="button" className="sp-date-foot-btn" onClick={() => {
                  const today = todayYMD()
                  setView(clampViewMonth({ y: today.y, m: today.m }, minPart, maxPart))
                  focusDay(toISO(today))
                }}>
                  {ar ? 'اليوم' : 'Today'}
                </button>
                {showClear && (
                  <button type="button" className="sp-date-foot-btn is-clear" onClick={handleClear}>
                    {ar ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
})
