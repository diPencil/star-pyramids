'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Card } from './admin-ui'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import type { RevenuePoint } from './admin-data'

const scopes = [
  { id: 'months', en: 'Months', ar: 'شهور' },
  { id: 'weeks', en: 'Weeks', ar: 'أسابيع' },
  { id: 'days', en: 'Days', ar: 'أيام' },
] as const

type Scope = (typeof scopes)[number]['id']

const W = 720
const H = 250
const PAD = { l: 52, r: 14, t: 14, b: 32 }

const compact = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)

export function RevenueTrend({
  monthly,
  weekly,
  daily,
}: {
  monthly: RevenuePoint[]
  weekly: RevenuePoint[]
  daily: RevenuePoint[]
}) {
  const ar = useAdminLocale() === 'ar'
  const [scope, setScope] = useState<Scope>('months')
  const data = scope === 'months' ? monthly : scope === 'weeks' ? weekly : daily
  const options = data.map((d) => d.full)
  const [from, setFrom] = useState(options[0])
  const [to, setTo] = useState(options[options.length - 1])

  const pick = (s: Scope) => {
    const next = s === 'months' ? monthly : s === 'weeks' ? weekly : daily
    setScope(s)
    setFrom(next[0].full)
    setTo(next[next.length - 1].full)
  }

  const fi = Math.max(0, options.indexOf(from))
  const ti = Math.max(fi, options.indexOf(to))
  const rows = data.slice(fi, ti + 1)

  const total = rows.reduce((s, r) => s + r.revenue, 0)
  const payments = rows.reduce((s, r) => s + r.payments, 0)
  const avg = payments ? Math.round(total / payments) : 0
  const max = Math.max(...rows.map((r) => r.revenue), 1)
  const ticks = [0, max / 2, max]

  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW)
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH

  const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r.revenue).toFixed(1)}`).join(' ')
  const base = (PAD.t + innerH).toFixed(1)
  const area = `${line} L${x(rows.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`

  return (
    <Card
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
          <span className="sp-range">
            <span><AdminText en="From" ar="من" /></span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label={ar ? 'من' : 'From'}>
              {options.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span><AdminText en="To" ar="إلى" /></span>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label={ar ? 'إلى' : 'To'}>
              {options.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
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
        <path d={area} className="sp-area" />
        <path d={line} className="sp-line" />
        {rows.map((r, i) => (
          <g key={r.full}>
            <circle cx={x(i)} cy={y(r.revenue)} r={6} className="sp-dot">
              <title>{`${r.full}: ${compact(r.revenue)} · ${r.payments} ${ar ? 'مدفوعات' : 'payments'}`}</title>
            </circle>
            <text x={x(i)} y={H - 10} textAnchor="middle" className="sp-x">{r.label}</text>
          </g>
        ))}
      </svg>
    </Card>
  )
}
