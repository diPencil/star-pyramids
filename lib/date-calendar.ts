/**
 * Pure calendar-date helpers for the shared DateInput.
 *
 * The form/storage contract is strict `YYYY-MM-DD`. All math here is
 * timezone-safe integer math on `{ y, m, d }` — `new Date('YYYY-MM-DD')`
 * (UTC-midnight parsing) is never used, so a selected `2026-10-03` can never
 * drift to `2026-10-02`/`2026-10-04`. `Date` objects appear only with
 * explicit local calendar fields, and only to read back locale display names
 * (month/weekday labels) or to step days via local `setDate`.
 */

export type YMD = { y: number; m: number; d: number }

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30
  return 31
}

export function parseYMD(raw: unknown): YMD | null {
  if (typeof raw !== 'string') return null
  const match = ISO_PATTERN.exec(raw.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (y < 1900 || y > 2200 || m < 1 || m > 12) return null
  if (d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

export function toKey(part: YMD): number {
  return part.y * 10000 + part.m * 100 + part.d
}

export function toISO(part: YMD): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${part.y}-${pad(part.m)}-${pad(part.d)}`
}

export function compareMonth(a: { y: number; m: number }, b: { y: number; m: number }): number {
  return a.y === b.y ? a.m - b.m : a.y - b.y
}

export function todayYMD(): YMD {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
}

export function addDays(part: YMD, delta: number): YMD {
  const base = new Date(part.y, part.m - 1, part.d)
  base.setDate(base.getDate() + delta)
  return { y: base.getFullYear(), m: base.getMonth() + 1, d: base.getDate() }
}

export function addMonths(view: { y: number; m: number }, delta: number): { y: number; m: number } {
  const total = view.y * 12 + (view.m - 1) + delta
  return { y: Math.floor(total / 12), m: (total % 12) + 1 }
}

export function clampViewMonth(
  view: { y: number; m: number },
  min: YMD | null,
  max: YMD | null,
): { y: number; m: number } {
  if (min && compareMonth(view, min) < 0) return { y: min.y, m: min.m }
  if (max && compareMonth(view, max) > 0) return { y: max.y, m: max.m }
  return view
}

export function initialViewMonth(
  value: string | undefined,
  min: YMD | null,
  max: YMD | null,
): { y: number; m: number } {
  const parsed = parseYMD(value)
  if (parsed) return clampViewMonth({ y: parsed.y, m: parsed.m }, min, max)
  const today = todayYMD()
  return clampViewMonth({ y: today.y, m: today.m }, min, max)
}

export type DateLocale = 'en' | 'es' | 'it' | 'ar'

function intlLocaleFor(locale: DateLocale): string {
  if (locale === 'ar') return 'ar-EG'
  if (locale === 'es') return 'es-ES'
  if (locale === 'it') return 'it-IT'
  return 'en-US'
}

export const MONTH_NAMES: Record<DateLocale, string[]> = {
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  es: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ],
  it: [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ],
  ar: [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ],
}

export const WEEKDAY_NAMES: Record<DateLocale, string[]> = {
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  es: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
  it: ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'],
  ar: ['أحد', 'اثنين', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
}

export function monthLabel(view: { y: number; m: number }, locale: DateLocale): string {
  try {
    // Local noon avoids every DST edge; only the month name is read back.
    const label = new Intl.DateTimeFormat(intlLocaleFor(locale), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(view.y, view.m - 1, 1, 12))
    if (label) return label
  } catch {
    /* fall through to static names */
  }
  return `${MONTH_NAMES[locale][view.m - 1]} ${view.y}`
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

function withLocaleDigits(value: string, locale: DateLocale): string {
  if (locale !== 'ar') return value
  return value.replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)])
}

/**
 * Closed-field display: strict `DD/MM/YYYY` (e.g. `01/10/2026`).
 * Display-only — the internal form/storage value always stays `YYYY-MM-DD`.
 * Arabic keeps the same day/month/year visual structure with Arabic-Indic
 * digits (project numeral convention); pure digit/slash runs are bidi-stable
 * so RTL cannot visually reorder them into `YYYY/MM/DD`.
 * The calendar month header (`monthLabel`) keeps localized month names.
 */
export function displayFor(iso: string, locale: DateLocale): string {
  const part = parseYMD(iso)
  if (!part) return ''
  const day = String(part.d).padStart(2, '0')
  const month = String(part.m).padStart(2, '0')
  const year = String(part.y).padStart(4, '0')
  return withLocaleDigits(`${day}/${month}/${year}`, locale)
}

export function fullDateLabel(iso: string, locale: DateLocale): string {
  const part = parseYMD(iso)
  if (!part) return iso
  try {
    return new Intl.DateTimeFormat(intlLocaleFor(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(part.y, part.m - 1, part.d, 12))
  } catch {
    return toISO(part)
  }
}
