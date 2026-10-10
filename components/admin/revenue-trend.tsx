'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { Card } from './admin-ui'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { SharedSelect } from '@/components/shared-select'
import type { RevenuePoint } from '@/lib/analytics'
import { revenueRange } from '@/lib/revenue-periods'

const scopes = [
  { id: 'months', en: 'Months', ar: 'شهور' },
  { id: 'weeks', en: 'Weeks', ar: 'أسابيع' },
  { id: 'days', en: 'Days', ar: 'أيام' },
] as const

type Scope = (typeof scopes)[number]['id']

const W = 720
const H = 250
const PAD = { l: 52, r: 48, t: 14, b: 40 }

const compact = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)

const DAY = 86400000
const SYSTEM_START_YEAR = 2020
const iso = (at: number) => new Date(at).toISOString().slice(0, 10)
const dateLabel = (at: number, short = false) => new Date(at).toLocaleDateString('en-US', { timeZone: 'UTC', month: short ? 'short' : 'long', day: 'numeric', year: 'numeric' })
const monthStart = (at: number) => { const d = new Date(at); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) }
const weekStart = (at: number) => { const d = new Date(at); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - ((d.getUTCDay() + 6) % 7) * DAY }

// Generate complete calendar periods for a given year and scope (client-side, zero payments)
function generateCalendarPeriods(year: number, scope: Scope): RevenuePoint[] {
  const points: RevenuePoint[] = []
  let start: number
  let end: number

  if (scope === 'months') {
    start = Date.UTC(year, 0, 1)
    end = Date.UTC(year + 1, 0, 1)
    let cursor = start
    while (cursor < end) {
      const d = new Date(cursor)
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
      const full = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
      const label = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' })
      points.push({ start: iso(cursor), end: iso(next - DAY), year: String(year), full, label, revenue: 0, payments: 0 })
      cursor = next
    }
  } else if (scope === 'weeks') {
    // First ISO week of the year (the week containing Jan 4)
    start = weekStart(Date.UTC(year, 0, 4))
    end = weekStart(Date.UTC(year + 1, 0, 4))
    let cursor = start
    let weekNum = 1
    while (cursor < end) {
      const next = cursor + 7 * DAY
      const thursday = new Date(cursor + 3 * DAY)
      const weekYear = thursday.getUTCFullYear()
      const full = `Week ${weekNum}, ${weekYear}: ${dateLabel(cursor, true)} to ${dateLabel(next - DAY, true)}`
      const label = `W${weekNum} ${weekYear}`
      points.push({ start: iso(cursor), end: iso(next - DAY), year: String(weekYear), full, label, revenue: 0, payments: 0 })
      cursor = next
      weekNum++
    }
  } else {
    start = Date.UTC(year, 0, 1)
    end = Date.UTC(year + 1, 0, 1)
    let cursor = start
    while (cursor < end) {
      const d = new Date(cursor)
      const next = cursor + DAY
      const full = dateLabel(cursor)
      const label = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
      points.push({ start: iso(cursor), end: iso(next - DAY), year: String(year), full, label, revenue: 0, payments: 0 })
      cursor = next
    }
  }
  return points
}

// Merge backend data (real revenue) with calendar periods (zero-payment periods)
function mergePeriods(calendar: RevenuePoint[], realData: RevenuePoint[]): RevenuePoint[] {
  const realMap = new Map(realData.map(p => [p.start, p]))
  return calendar.map(p => realMap.get(p.start) ?? p)
}

export function RevenueTrend({
  monthly,
  weekly,
  daily,
  currentYear,
}: {
  monthly: RevenuePoint[]
  weekly: RevenuePoint[]
  daily: RevenuePoint[]
  currentYear: number
}) {
  const ar = useAdminLocale() === 'ar'
  const [scope, setScope] = useState<Scope>('months')

  const dataMap = useMemo(() => ({ months: monthly, weeks: weekly, days: daily }), [monthly, weekly, daily])
  const realData = dataMap[scope]

  // Years from fixed system start (2020) to current year + 5, regardless of payments
  const allYears = useMemo(() => {
    const years: string[] = []
    const endYear = currentYear + 5
    for (let y = SYSTEM_START_YEAR; y <= endYear; y++) years.push(String(y))
    return years
  }, [currentYear])
  const [browseYear, setBrowseYear] = useState(String(currentYear))
  const year = Number(browseYear ?? currentYear)

  // Generate complete calendar for selected year/scope, merge with real data
  const calendar = useMemo(() => generateCalendarPeriods(year, scope), [year, scope])
  const data = useMemo(() => mergePeriods(calendar, realData), [calendar, realData])

  // Default range: first to last period of selected year
  const [range, setRange] = useState(() => ({ from: data[0]?.start ?? '', to: data[data.length - 1]?.end ?? '' }))
  const { from, to, rows } = revenueRange(data, range.from, range.to)

  // Options for dropdowns: all periods in selected year
  const selectedLabel = (point: RevenuePoint) => scope === 'weeks'
    ? point.label
    : point.full
  const filterOptions = (endpoint: 'start' | 'end') => data.map((point) => ({
    value: point[endpoint],
    label: <span className="sp-trend-option" style={scope === 'weeks' ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', display: 'block' } : undefined}>{scope === 'weeks' ? point.label : point.full}</span>,
    selectedLabel: selectedLabel(point),
    text: point.full,
  }))

  // Reset from/to when scope changes
  const pick = (s: Scope) => {
    setScope(s)
    // Range will be reset via effect when data changes
  }

  // Reset range when data (year/scope) changes
  useEffect(() => {
    setRange({ from: data[0]?.start ?? '', to: data[data.length - 1]?.end ?? '' })
  }, [data])

  // Ensure from <= to when user changes either value
  const handleFromChange = (value: string) => {
    const point = data.find((row) => row.start === value)
    if (point) setRange({ from: point.start, to: point.start > to ? point.end : to })
  }

  const handleToChange = (value: string) => {
    const point = data.find((row) => row.end === value)
    if (point) setRange({ from: point.end < from ? point.start : from, to: point.end })
  }

  const total = rows.reduce((s, r) => s + r.revenue, 0)
  const payments = rows.reduce((s, r) => s + r.payments, 0)
  const avg = payments ? Math.round(total / payments) : 0
  const max = rows.reduce((value, row) => Math.max(value, row.revenue), 1)
  const ticks = [0, max / 2, max]

  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  // For first/last label, nudge slightly inward to prevent clipping at edges
  const x = (i: number) => {
    const baseX = PAD.l + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW)
    if (rows.length > 1) {
      if (i === 0) return baseX + 4
      if (i === rows.length - 1) return baseX - 4
    }
    return baseX
  }
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH

  const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.revenue).toFixed(1)}`).join(' ')
  const base = (PAD.t + innerH).toFixed(1)
  const area = `${line} L${x(rows.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`

  // X-axis label intervals: months=all (12), weeks/days=6-8 evenly spaced
  const getLabelIndices = (count: number, scope: Scope): number[] => {
    const indices: number[] = []
    if (count <= 12) {
      // Months: show all
      for (let i = 0; i < count; i++) indices.push(i)
    } else {
      // Weeks/Days: show 6-8 labels evenly distributed
      const targetLabels = 7
      const step = Math.max(1, Math.round((count - 1) / (targetLabels - 1)))
      for (let i = 0; i < count; i += step) indices.push(i)
      if (indices[indices.length - 1] !== count - 1) indices.push(count - 1)
    }
    return indices
  }
  const labelIndices = getLabelIndices(rows.length, scope)

  return (
    <Card
      className="sp-revenue-trend"
      title={
        <span className="sp-card-title-row">
          <span className="sp-card-ic"><FileText size={18} /></span><AdminText en="Revenue trend" ar="اتجاه الإيرادات" />
        </span>
      }
      sub={<AdminText en="Posted payments collected and average payment for the selected period." ar="المدفوعات المحصلة ومتوسط الدفعة للفترة المحددة." />}
      action={
        <span className="sp-trend-tools">
          <span className="sp-seg" role="tablist" aria-label={ar ? 'الفترة' : 'Period'}>
            {scopes.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={scope === s.id} className={scope === s.id ? 'active' : ''} onClick={() => pick(s.id)}>
                {ar ? s.ar : s.en}
              </button>
            ))}
          </span>
          <span className="sp-trend-years">
            <button type="button" className="sp-icon-btn" aria-label={ar ? 'السنة السابقة' : 'Previous year'} disabled={allYears.indexOf(String(year)) <= 0} onClick={() => setBrowseYear(allYears[allYears.indexOf(String(year)) - 1])}><ChevronLeft size={14} /></button>
            <SharedSelect value={String(year)} onChange={setBrowseYear} options={allYears.map((value) => ({ value, label: value }))} label={ar ? 'السنة' : 'Year'} locale={ar ? 'ar' : 'en'} modal={false} />
            <button type="button" className="sp-icon-btn" aria-label={ar ? 'السنة التالية' : 'Next year'} disabled={allYears.indexOf(String(year)) >= allYears.length - 1} onClick={() => setBrowseYear(allYears[allYears.indexOf(String(year)) + 1])}><ChevronRight size={14} /></button>
          </span>
          <span className="sp-range">
            <span className="sp-range-field">
            <span><AdminText en="From" ar="من" /></span>
            <SharedSelect
              value={from}
              onChange={handleFromChange}
              locale={ar ? 'ar' : 'en'}
              label={ar ? 'من' : 'From'}
              options={filterOptions('start')}
              className="sp-range-select"
              popupAlign="start"
              modal={false}
            />
            </span>
            <span className="sp-range-field">
            <span><AdminText en="To" ar="إلى" /></span>
            <SharedSelect
              value={to}
              onChange={handleToChange}
              locale={ar ? 'ar' : 'en'}
              label={ar ? 'إلى' : 'To'}
              options={filterOptions('end')}
              className="sp-range-select"
              popupAlign="start"
              modal={false}
            />
            </span>
          </span>
        </span>
      }
    >
      <div className="sp-legend-pills">
        <span className="sp-legend-pill"><i style={{ background: '#f7951d' }} /><AdminText en={`Revenue · ${compact(total)}`} ar={`الإيرادات · ${compact(total)}`} /></span>
        <span className="sp-legend-pill"><i style={{ background: '#163a96' }} /><AdminText en={`Payments · ${payments.toLocaleString('en-US')}`} ar={`المدفوعات · ${payments.toLocaleString('en-US')}`} /></span>
        <span className="sp-legend-pill"><i style={{ background: '#9aa3b2' }} /><AdminText en={`Average payment · $${avg.toLocaleString('en-US')}`} ar={`متوسط الدفعة · $${avg.toLocaleString('en-US')}`} /></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sp-trend-svg" role="img" aria-label={ar ? 'رسم اتجاه الإيرادات' : 'Revenue trend chart'}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="sp-grid" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="sp-tick">{compact(t)}</text>
          </g>
        ))}
        {rows.length > 0 && <path d={area} className="sp-area" />}
        <path d={line} className="sp-line" />
        <defs>
            <style>{`
              .sp-dot { opacity: 0; transition: opacity 0.15s ease; }
              .sp-data-point:hover .sp-dot { opacity: 1; }
              .sp-data-point:focus-within .sp-dot { opacity: 1; }
            `}</style>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="sp-grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="sp-tick">{compact(t)}</text>
            </g>
          ))}
          {rows.length > 0 && <path d={area} className="sp-area" />}
          <path d={line} className="sp-line" />
          {rows.map((r, i) => (
            <g key={r.full} className="sp-data-point" tabIndex={0}>
              <circle cx={x(i)} cy={y(r.revenue)} r={5} className="sp-dot">
                <title>{`${r.full}: ${compact(r.revenue)} · ${r.payments} ${ar ? 'مدفوعات' : 'payments'}`}</title>
              </circle>
              {labelIndices.includes(i) && <text x={x(i)} y={H - 8} textAnchor="middle" className="sp-x">{r.label}</text>}
            </g>
          ))}
        </svg>
    </Card>
  )
}
