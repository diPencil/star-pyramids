import assert from 'node:assert/strict'
import { revenueSeries, revenueRange } from '../lib/revenue-periods.ts'

const rows = [
  { at: Date.parse('2022-01-01T23:59:59Z'), cents: 100 },
  { at: Date.parse('2024-02-29T12:00:00Z'), cents: 200 },
  { at: Date.parse('2024-12-30T00:00:00Z'), cents: 2500 },
  { at: Date.parse('2025-01-05T23:59:59Z'), cents: 900 },
]
const now = Date.parse('2025-01-06T12:00:00Z')
const monthly = revenueSeries(rows, 'months', now)
const weekly = revenueSeries(rows, 'weeks', now)
const daily = revenueSeries(rows, 'days', now)
assert.equal(monthly.length, 37)
assert.ok(weekly.length > 150)
assert.ok(daily.length > 1000)
for (const series of [monthly, weekly, daily]) {
  assert.equal(series.reduce((sum, point) => sum + point.revenue, 0), 37)
  assert.equal(series.reduce((sum, point) => sum + point.payments, 0), 4)
  assert.ok(series.some((point) => point.payments === 0))
  assert.equal(revenueRange(series, '', '').rows.length, series.length)
  assert.equal(new Set(series.map((point) => point.start)).size, series.length)
}
assert.equal(daily.find((point) => point.start === '2024-02-29').revenue, 2)
const newYear = weekly.find((point) => point.start === '2024-12-30')
assert.equal(newYear.year, '2025')
assert.equal(newYear.end, '2025-01-05')
assert.equal(newYear.revenue, 34)
assert.match(newYear.full, /^Week 1, 2025:/)
const week53 = revenueSeries([{ at: Date.parse('2021-01-01T00:00:00Z'), cents: 100 }], 'weeks', Date.parse('2021-01-04T00:00:00Z'))[0]
assert.equal(week53.year, '2020')
assert.match(week53.full, /^Week 53, 2020:/)
const leapMonth = revenueRange(monthly, '2024-02-10', '2024-02-29')
assert.equal(leapMonth.from, '2024-02-01')
assert.equal(leapMonth.to, '2024-02-29')
assert.equal(revenueRange(daily, leapMonth.from, leapMonth.to).rows.length, 29)
assert.equal(revenueRange(weekly, '2024-12-31', '2025-01-02').rows[0].start, '2024-12-30')
assert.equal(revenueRange(daily, '2025-01-05', '2024-02-29').rows.length, 1)
assert.equal(revenueRange([], '', '').rows.length, 0)
assert.equal(revenueSeries([], 'days', now)[0].payments, 0)
console.log('PASS: complete history, totals, zero gaps, leap day, ISO week years/53, mode/range alignment, reversed/empty range')
