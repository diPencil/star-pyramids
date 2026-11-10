import type { RevenuePoint } from './analytics'

export type RevenueScope = 'months' | 'weeks' | 'days'
const DAY = 86400000
const iso = (at: number) => new Date(at).toISOString().slice(0, 10)
const dateLabel = (at: number, short = false) => new Date(at).toLocaleDateString('en-US', { timeZone: 'UTC', month: short ? 'short' : 'long', day: 'numeric', year: 'numeric' })
const monthStart = (at: number) => { const d = new Date(at); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) }
const weekStart = (at: number) => { const d = new Date(at); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY }

export function revenueSeries(rows: Array<{ at: number; cents: number }>, scope: RevenueScope, now = Date.now(), historyStart = 0): RevenuePoint[] {
  const end = Math.floor(now / DAY) * DAY + DAY
  const sorted = rows.filter((row) => Number.isFinite(row.at) && row.at < end).sort((a, b) => a.at - b.at)

  let start: number
  if (sorted.length > 0) {
    // Start from the beginning of the first payment's year so that each selectable year
    // has all 12 months / 52-53 ISO weeks / 365-366 days, including zero-payment periods.
    const firstPaymentDate = new Date(sorted[0].at)
    let firstPaymentYear: number
    if (scope === 'weeks') {
      // ISO week year is the year of the Thursday of the payment's week.
      // Find the Monday of the payment's week, then add 3 days to get Thursday.
      const paymentWeekStart = weekStart(firstPaymentDate.getTime())
      const thursday = new Date(paymentWeekStart + 3 * DAY)
      firstPaymentYear = thursday.getUTCFullYear()
    } else {
      firstPaymentYear = firstPaymentDate.getUTCFullYear()
    }
    if (scope === 'months') {
      start = Date.UTC(firstPaymentYear, 0, 1)
    } else if (scope === 'weeks') {
      // First ISO week of the year (the week containing Jan 4)
      start = weekStart(Date.UTC(firstPaymentYear, 0, 4))
    } else {
      start = Date.UTC(firstPaymentYear, 0, 1)
    }
    // Respect historyStart only as a genuine cutoff (before the year start).
    if (historyStart > 0 && historyStart < start) {
      start = historyStart
    }
  } else {
    // No payments: generate a single period at current time (respecting historyStart as floor).
    start = scope === 'months' ? monthStart(now) : scope === 'weeks' ? weekStart(now) : Math.floor(now / DAY) * DAY
    if (historyStart > start) start = historyStart
  }

  const points: RevenuePoint[] = []
  let cursor = 0
  while (start < end) {
    const d = new Date(start)
    const next = scope === 'months' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) : start + (scope === 'weeks' ? 7 : 1) * DAY
    let cents = 0, payments = 0
    while (cursor < sorted.length && sorted[cursor].at < next) { cents += sorted[cursor].cents; payments++; cursor++ }
    let full = dateLabel(start)
    let periodYear = String(d.getUTCFullYear())
    let label = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
    if (scope === 'months') {
      full = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
      label = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' })
    } else if (scope === 'weeks') {
      // ISO week year belongs to the Thursday, including weeks spanning New Year.
      const thursday = new Date(start + 3 * DAY)
      const year = thursday.getUTCFullYear()
      periodYear = String(year)
      const number = Math.round((start - weekStart(Date.UTC(year, 0, 4))) / (7 * DAY)) + 1
      full = `Week ${number}, ${year}: ${dateLabel(start, true)} to ${dateLabel(next - DAY, true)}`
      label = `W${number} ${year}`
    }
    points.push({ start: iso(start), end: iso(next - DAY), year: periodYear, full, label, revenue: cents / 100, payments })
    start = next
  }
  return points
}

export function revenueRange(data: RevenuePoint[], from: string, to: string) {
  if (!data.length) return { from: '', to: '', rows: [] as RevenuePoint[] }
  from = from || data[0].start
  to = to || data[data.length - 1].end
  const first = data.find((point) => point.end >= from) ?? data[data.length - 1]
  const last = [...data].reverse().find((point) => point.start <= to) ?? data[0]
  const start = first.start
  const end = last.start < start ? first.end : last.end
  return { from: start, to: end, rows: data.filter((point) => point.start >= start && point.end <= end) }
}
