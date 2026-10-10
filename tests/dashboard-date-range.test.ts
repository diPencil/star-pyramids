// Dashboard date-range contract.
//
// Pins the end-to-end Today/same-day filtering window shared by every
// dashboard KPI and chart query: a `from === to` range covers the full
// 24h day (00:00:00.000 inclusive → next 00:00:00.000 exclusive), and the
// dashboard default window is built from the same local-calendar Today
// the DateInput "Today" button selects (no UTC-slice drift).
import { describe, expect, it } from 'vitest';

import { addDays, toISO, todayYMD } from '@/lib/date-calendar';
import { AnalyticsValidationError, parseAnalyticsRange } from '@/lib/analytics-range';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mirror of the `gte: start, lt: endExclusive` predicate every
 *  analytics query (bookings, payments, customers, lines, requests,
 *  enquiries, reviews) applies to its date field. */
function inWindow(range: { start: Date; endExclusive: Date }, at: number): boolean {
  return at >= range.start.getTime() && at < range.endExclusive.getTime();
}

describe('dashboard date range', () => {
  it('same-day (Today) range covers the full current day, 00:00 through end of day', () => {
    const range = parseAnalyticsRange(new URLSearchParams({ from: '2026-10-10', to: '2026-10-10' }))
    expect(range.from).toBe('2026-10-10')
    expect(range.to).toBe('2026-10-10')
    expect(range.start.toISOString()).toBe('2026-10-10T00:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2026-10-11T00:00:00.000Z')
    expect(range.endExclusive.getTime() - range.start.getTime()).toBe(DAY_MS)

    // First millisecond, midday, and last millisecond of Today are in.
    expect(inWindow(range, Date.parse('2026-10-10T00:00:00.000Z'))).toBe(true)
    expect(inWindow(range, Date.parse('2026-10-10T12:00:00.000Z'))).toBe(true)
    expect(inWindow(range, Date.parse('2026-10-10T23:59:59.999Z'))).toBe(true)
    // Adjacent days are out — no bleed into yesterday or tomorrow.
    expect(inWindow(range, Date.parse('2026-10-09T23:59:59.999Z'))).toBe(false)
    expect(inWindow(range, Date.parse('2026-10-11T00:00:00.000Z'))).toBe(false)
  })

  it('multi-day ranges stay inclusive on both ends', () => {
    const range = parseAnalyticsRange(new URLSearchParams({ from: '2026-10-01', to: '2026-10-10' }))
    expect(range.start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2026-10-11T00:00:00.000Z')
    expect(inWindow(range, Date.parse('2026-10-01T00:00:00.000Z'))).toBe(true)
    expect(inWindow(range, Date.parse('2026-10-10T23:59:59.999Z'))).toBe(true)
    expect(inWindow(range, Date.parse('2026-10-11T00:00:00.000Z'))).toBe(false)
  })

  it('rejects inverted, malformed, and over-long ranges', () => {
    expect(() => parseAnalyticsRange(new URLSearchParams({ from: '2026-10-11', to: '2026-10-10' }))).toThrowError(
      AnalyticsValidationError,
    )
    expect(() => parseAnalyticsRange(new URLSearchParams({ from: 'not-a-date', to: '2026-10-10' }))).toThrowError(
      AnalyticsValidationError,
    )
    expect(() => parseAnalyticsRange(new URLSearchParams({ from: '2020-01-01', to: '2026-10-10' }))).toThrowError(
      AnalyticsValidationError,
    )
  })

  it('dashboard default window ends on the local Today the date picker selects', () => {
    // Mirrors `defaultRange()` in app/admin/dashboard/page.tsx.
    const today = todayYMD()
    const from = toISO(addDays(today, -89))
    const to = toISO(today)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const expectedToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    expect(to).toBe(expectedToday)
    // Trailing 90 calendar days, same shape as before.
    expect((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS).toBe(89)
    // And that Today key parses back to the same full-day window.
    const range = parseAnalyticsRange(new URLSearchParams({ from: to, to }))
    expect(range.endExclusive.getTime() - range.start.getTime()).toBe(DAY_MS)
  })
});
