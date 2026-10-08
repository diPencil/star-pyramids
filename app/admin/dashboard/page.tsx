'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, CalendarCheck, Eye, ShoppingCart, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminTableWrap, AdminText, Avatar, Card, Delta, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { RevenueTrend } from '@/components/admin/revenue-trend'
import { DateInput } from '@/components/date-input'
import type { AnalyticsResponse } from '@/lib/analytics'
import type { StaffBooking } from '@/lib/booking'
import { tours } from '@/data/tours'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'

const maxBar = 65

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 89 * 24 * 60 * 60 * 1000)
  return { from: toISODate(from), to: toISODate(to) }
}

function fmtMoney(amount: number, currency: string): string {
  const grouped = amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return currency === 'USD' ? `$${grouped}` : `${grouped} ${currency}`
}

function primaryMoney(rows: Array<{ currency: string; amount: number }>): { amount: number; currency: string } {
  if (rows.length === 0) return { amount: 0, currency: 'USD' }
  const usd = rows.find((row) => row.currency === 'USD')
  if (usd) return usd
  return [...rows].sort((a, b) => b.amount - a.amount)[0]
}

/**
 * Growth pill with an honest zero-baseline state: `null` (previous
 * period empty, current non-empty) renders "New" instead of a fake
 * +100%. `0` is shown only when both periods are zero.
 */
function DeltaValue({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="sp-pill is-active"><AdminText en="New" ar="جديد" /></span>
  }
  return <Delta value={value} />
}

function Donut({ split, total }: { split: Array<{ label: string; value: number; delta: number | null }>; total: number }) {
  const grand = split.reduce((s, t) => s + t.value, 0)
  const colors = ['#2b5ce6', '#f7951d', '#e11d48', '#cbd5e1']
  let acc = 0
  const segs = split.map((t, i) => {
    const frac = grand > 0 ? t.value / grand : 0
    const seg = { ...t, from: acc, to: acc + frac, color: colors[i % colors.length] }
    acc += frac
    return seg
  })
  const r = 54
  const c = 2 * Math.PI * r
  return (
    <div className="sp-donut-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Tour split">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#eef1f7" strokeWidth="16" />
        {segs.map((s) => (
          <circle
            key={s.label}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${Math.max((s.to - s.from) * c - 6, 0)} ${c}`}
            strokeDashoffset={-s.from * c + c * 0.25}
          />
        ))}
      </svg>
      <div>
        <span className="sp-donut-num">{total.toLocaleString('en-US')}</span>
        <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12 }}><AdminText en="Trips sold" ar="الرحلات المباعة" /></p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const ar = useAdminLocale() === 'ar'
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSeq = useRef(0)
  // Real booking counters: stored bookings from the admin API.
  const [liveBookings, setLiveBookings] = useState<StaffBooking[] | null>(null)
  // 403 here means the viewer's role lacks bookings.view: the card below
  // renders the same honest restricted state as the financial KPIs instead
  // of an empty table that could read as "no bookings".
  const [bookingsForbidden, setBookingsForbidden] = useState(false)
  // Real tour count from the DB-authoritative catalogue (bootstrap length
  // until the response arrives).
  const [tourCount, setTourCount] = useState<number | null>(null)
  const liveTours = tourCount ?? tours.length
  useEffect(() => {
    let cancelled = false
    fetch('/api/tours', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const payload = (await res.json()) as { tours?: unknown[] }
        if (!cancelled && Array.isArray(payload.tours)) setTourCount(payload.tours.length)
      })
      .catch(() => { /* bootstrap count stays */ })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/bookings', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok || cancelled) {
          if (!cancelled && res.status === 403) setBookingsForbidden(true)
          return
        }
        const payload = (await res.json()) as { bookings?: StaffBooking[] }
        if (!cancelled && Array.isArray(payload.bookings)) setLiveBookings(payload.bookings)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to

  const loadAnalytics = useCallback(() => {
    if (!rangeValid) return
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setLoading(true)
    setError('')
    fetch(`/api/admin/analytics?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (requestSeq.current !== seq) return
        const payload = (await res.json()) as AnalyticsResponse & { error?: string }
        if (!res.ok) {
          setError(typeof payload.error === 'string' && payload.error ? payload.error : 'Could not load dashboard analytics.')
          setLoading(false)
          return
        }
        setData(payload)
        setLoading(false)
      })
      .catch(() => {
        if (requestSeq.current !== seq) return
        setError('Could not load dashboard analytics.')
        setLoading(false)
      })
  }, [range.from, range.to, rangeValid])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const latest = (liveBookings ?? []).slice(0, 5).map((b) => ({
    id: b.reference,
    customer: b.account?.name || b.contact.name,
    avatar: '',
    tour: b.lines[0]?.title ?? '-',
    date: b.lines.map((line) => line.date).find((d) => d !== '') ?? b.createdAt.slice(0, 10),
    total: b.total,
    status: b.status,
  }))
  const latestBookingSort = useAdminTableSort(latest, {
    customer: (booking) => booking.customer,
    tour: (booking) => booking.tour,
    date: (booking) => Date.parse(booking.date),
    total: (booking) => booking.total,
    status: (booking) => booking.status,
  }, 'date', 'desc')

  const kpis = data?.kpis ?? null
  const revenue = primaryMoney(kpis?.collected ?? [])
  const volume = primaryMoney(kpis?.bookingVolume ?? [])
  const outstanding = primaryMoney(kpis?.outstanding ?? [])
  const bookedTotal = (data?.bookingMonthly ?? []).reduce((s, b) => s + b.booked, 0)
  const rangeLabel = `${range.from} → ${range.to}`
  const emptyRange = !loading && !error && data !== null && kpis !== null &&
    kpis.bookings.total === 0 && kpis.collectedPayments === 0 && kpis.newCustomers === 0 &&
    data.pipeline.tripRequests.total === 0 && data.pipeline.enquiries.total === 0

  return (
    <>
      <PageHead
        eyebrow="Sales Report"
        title="Dashboard"
        titleAr="لوحة المؤشرات"
        sub={`Friday plan · ${liveTours} live tours in catalogue`}
        subAr={`خطة الجمعة · ${liveTours} رحلة منشورة في الكتالوج`}
        actions={
          <>
            <Link className="sp-btn" href="/admin/bookings"><AdminText en="View bookings" ar="عرض الحجوزات" /></Link>
            <Link className="sp-btn primary" href="/admin/trips/builder">+ <AdminText en="New trip" ar="رحلة جديدة" /></Link>
          </>
        }
      />

      <div className="sp-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <AdminText en="From" ar="من" />
          <DateInput value={range.from} max={range.to} onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))} aria-label={ar ? 'من' : 'From'} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
          <AdminText en="To" ar="إلى" />
          <DateInput value={range.to} min={range.from} onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))} aria-label={ar ? 'إلى' : 'To'} />
        </label>
        <span className="sp-pill is-active">{rangeLabel}</span>
        {!rangeValid && <span role="alert" style={{ color: '#b42318', fontSize: 12 }}><AdminText en="The start date must be on or before the end date." ar="يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له." /></span>}
        {loading && <span role="status" style={{ fontSize: 12, color: 'var(--sp-muted)' }}><AdminText en="Loading analytics…" ar="جارٍ تحميل التحليلات…" /></span>}
      </div>

      {error !== '' && (
        <div className="sp-card" role="alert" style={{ marginBottom: 16 }}>
          <strong><AdminText en="Dashboard analytics unavailable" ar="تعذر تحميل تحليلات اللوحة" /></strong>
          <p style={{ margin: '4px 0 12px', color: 'var(--sp-muted)', fontSize: 13 }}>{error}</p>
          <button type="button" className="sp-btn primary" onClick={loadAnalytics}><AdminText en="Retry" ar="إعادة المحاولة" /></button>
        </div>
      )}

      {emptyRange && (
        <div className="sp-card" style={{ marginBottom: 16 }}>
          <AdminEmpty
            title={<AdminText en="No records in this range" ar="لا توجد سجلات في هذه الفترة" />}
            copy={<AdminText en="Bookings, payments, customers and requests created between the selected dates will appear here." ar="ستظهر هنا الحجوزات والمدفوعات والعملاء والطلبات المنشأة بين التاريخين المحددين." />}
          />
        </div>
      )}

      <div className="sp-kpis">
        <section className="sp-card sp-kpi blue">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><ShoppingCart size={19} /></span>
            {kpis && data?.financial ? <DeltaValue value={kpis.deltas.revenuePct} /> : kpis ? null : <Delta value={0} />}
          </div>
          <small><AdminText en="Collected Revenue" ar="الإيرادات المحصلة" /></small>
          {data && !data.financial ? (
            <>
              <strong><AdminText en="Restricted" ar="مقيّد" /></strong>
              <div className="sp-kpi-foot"><AdminText en="Requires payments.view" ar="يتطلب صلاحية payments.view" /></div>
            </>
          ) : (
            <>
              <strong>{loading && !kpis ? '…' : fmtMoney(revenue.amount, revenue.currency)}</strong>
              <div className="sp-kpi-foot">
                {kpis
                  ? <AdminText en={`Net collected · ${kpis.collectedPayments} payments`} ar={`صافي التحصيل · ${kpis.collectedPayments} مدفوعات`} />
                  : <AdminText en="Net collected payments" ar="صافي المدفوعات المحصلة" />}
              </div>
              {kpis && kpis.outstandingPayments > 0 && (
                <div className="sp-kpi-foot"><AdminText en={`Outstanding ${fmtMoney(outstanding.amount, outstanding.currency)} · ${kpis.outstandingPayments} pending`} ar={`مستحق ${fmtMoney(outstanding.amount, outstanding.currency)} · ${kpis.outstandingPayments} معلقة`} /></div>
              )}
            </>
          )}
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><CalendarCheck size={19} /></span>
            {kpis ? <DeltaValue value={kpis.deltas.bookingsPct} /> : <Delta value={0} />}
          </div>
          <small><AdminText en="Total Bookings" ar="إجمالي الحجوزات" /></small>
          <strong>{loading && !kpis ? '…' : (kpis?.bookings.total ?? 0).toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot">
            {kpis
              ? <AdminText en={`Confirmed ${kpis.bookings.confirmed} · Cancelled ${kpis.bookings.cancelled}`} ar={`مؤكدة ${kpis.bookings.confirmed} · ملغاة ${kpis.bookings.cancelled}`} />
              : <AdminText en="Bookings created in range" ar="الحجوزات المنشأة في الفترة" />}
          </div>
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><Eye size={19} /></span>
            {kpis ? <DeltaValue value={kpis.deltas.customersPct} /> : <Delta value={0} />}
          </div>
          <small><AdminText en="New Customers" ar="عملاء جدد" /></small>
          <strong>{loading && !kpis ? '…' : (kpis?.newCustomers ?? 0).toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot"><AdminText en="Registrations in range" ar="التسجيلات في الفترة" /></div>
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><Users size={19} /></span>
            {kpis ? <DeltaValue value={kpis.deltas.tripsPct} /> : <Delta value={0} />}
          </div>
          <small><AdminText en="Trips Sold" ar="الرحلات المباعة" /></small>
          <strong>{loading && !kpis ? '…' : (kpis?.tripsSold ?? 0).toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot">
            {kpis
              ? <AdminText en={`Booked volume ${fmtMoney(volume.amount, volume.currency)}`} ar={`حجم الحجوزات ${fmtMoney(volume.amount, volume.currency)}`} />
              : <AdminText en="Lines in non-cancelled bookings" ar="البنود في الحجوزات غير الملغاة" />}
          </div>
        </section>
      </div>

      <div className="sp-grid-dash">
        <Card
          title={
            <span className="sp-card-title-row">
              <span className="sp-card-ic"><BarChart3 size={18} /></span><AdminText en="Booking Habits" ar="عادات الحجز" />
            </span>
          }
          sub={<AdminText en="Bookings created per month in range" ar="الحجوزات المنشأة شهريًا في الفترة" />}
          action={<span className="sp-pill is-active">{rangeLabel}</span>}
        >
          <div className="sp-legend-pills">
            <span className="sp-legend-pill"><i style={{ background: '#163a96' }} /><AdminText en={`Booked · ${bookedTotal}`} ar={`المحجوز · ${bookedTotal}`} /></span>
          </div>
          {(data?.bookingMonthly ?? []).length > 0 ? (
            <div className="sp-bars">
              {(data?.bookingMonthly ?? []).map((b) => (
                <div key={b.month} className="sp-bar-col">
                  <div className="sp-bar-pair">
                    <i className="b" style={{ height: `${(b.booked / Math.max(maxBar, bookedTotal, 1)) * 170}px` }} title={ar ? `محجوز ${b.booked}` : `Booked ${b.booked}`} />
                  </div>
                  <span>{b.month}</span>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmpty
              title={<AdminText en="No bookings in range" ar="لا حجوزات في الفترة" />}
              copy={<AdminText en="Widen the date range to see monthly bookings." ar="وسّع الفترة الزمنية لرؤية الحجوزات الشهرية." />}
            />
          )}
        </Card>

        <Card
          title={<AdminText en="Tour Statistic" ar="إحصائيات الرحلات" />}
          sub={<AdminText en="Sold lines by tour category in range" ar="البنود المباعة حسب فئة الرحلة في الفترة" />}
          action={<span className="sp-pill is-active">{rangeLabel}</span>}
        >
          <Donut split={data?.tourSplit ?? []} total={data?.tourSplitTotal ?? 0} />
          <div className="sp-legend">
            {(data?.tourSplit ?? []).map((t) => (
              <div key={t.label}>
                <span>{t.label}</span>
                <b>{t.value.toLocaleString('en-US')}</b>
                <DeltaValue value={t.delta} />
              </div>
            ))}
            {(data?.tourSplit ?? []).length === 0 && !loading && (
              <AdminEmpty
                title={<AdminText en="No trips sold in range" ar="لا رحلات مباعة في الفترة" />}
                copy={<AdminText en="Non-cancelled booking lines in range will appear here." ar="ستظهر هنا بنود الحجوزات غير الملغاة في الفترة." />}
              />
            )}
          </div>
        </Card>
      </div>

      {data && data.financial ? (
        <RevenueTrend monthly={data.trend.monthly} weekly={data.trend.weekly} daily={data.trend.daily} />
      ) : data && !data.financial ? (
        <Card
          title={<AdminText en="Revenue trend" ar="اتجاه الإيرادات" />}
          sub={<AdminText en="Restricted financial view." ar="عرض مالي مقيّد." />}
        >
          <AdminEmpty
            title={<AdminText en="Revenue data restricted" ar="بيانات الإيرادات مقيّدة" />}
            copy={<AdminText en="Your role can view bookings but not financial figures. Ask an admin for payments.view." ar="دورك يتيح عرض الحجوزات دون الأرقام المالية. اطلب صلاحية payments.view من المسؤول." />}
          />
        </Card>
      ) : (
        <Card
          title={<AdminText en="Revenue trend" ar="اتجاه الإيرادات" />}
          sub={<AdminText en="Posted payments collected and average payment for the selected period." ar="المدفوعات المحصلة ومتوسط الدفعة للفترة المحددة." />}
        >
          {loading
            ? <span role="status"><AdminText en="Loading revenue…" ar="جارٍ تحميل الإيرادات…" /></span>
            : <AdminEmpty
              title={<AdminText en="No revenue data" ar="لا بيانات إيرادات" />}
              copy={<AdminText en="Collected payments will appear here once settled." ar="ستظهر المدفوعات المحصلة هنا بعد تحصيلها." />}
            />}
        </Card>
      )}

      <div className="sp-grid-dash">
        <Card
          title={<AdminText en="Latest bookings" ar="أحدث الحجوزات" />}
          sub={<AdminText en="Bookings needing follow-up first" ar="الحجوزات التي تحتاج متابعة أولا" />}
          action={<Link className="sp-btn" href="/admin/bookings"><AdminText en="View all" ar="عرض الكل" /></Link>}
        >
          {bookingsForbidden ? (
            <AdminEmpty
              title={<AdminText en="Bookings restricted" ar="الحجوزات مقيّدة" />}
              copy={<AdminText en="Your role cannot view bookings. Ask an admin for bookings.view." ar="دورك لا يتيح عرض الحجوزات. اطلب صلاحية bookings.view من المسؤول." />}
            />
          ) : (
          <AdminTableWrap><table className="sp-table">
            <thead>
              <tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" sortKey={latestBookingSort.sortKey} direction={latestBookingSort.direction} onSort={latestBookingSort.sortBy} /><SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tour" sortKey={latestBookingSort.sortKey} direction={latestBookingSort.direction} onSort={latestBookingSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" sortKey={latestBookingSort.sortKey} direction={latestBookingSort.direction} onSort={latestBookingSort.sortBy} /><SortableTh label={<AdminText en="Total" ar="الإجمالي" />} column="total" sortKey={latestBookingSort.sortKey} direction={latestBookingSort.direction} onSort={latestBookingSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={latestBookingSort.sortKey} direction={latestBookingSort.direction} onSort={latestBookingSort.sortBy} /></tr>
            </thead>
            <tbody>
              {latestBookingSort.sortedRows.map((b, index) => (
                <tr key={b.id}>
                  <td className="sp-row-number">{index + 1}</td>
                  <td>
                    <span className="sp-cust">
                      <Avatar name={b.customer} src={b.avatar} size={32} />
                      <span><strong>{b.customer}</strong><small>{b.id}</small></span>
                    </span>
                  </td>
                  <td>{b.tour}</td>
                  <td>{b.date}</td>
                  <td>${b.total.toLocaleString('en-US')}</td>
                  <td><StatusPill status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></AdminTableWrap>
          )}
        </Card>

        <Card
          title={<AdminText en="Bookings by Markets" ar="الحجوزات حسب الأسواق" />}
          sub={<AdminText en="Bookings created in range by customer country" ar="الحجوزات المنشأة في الفترة حسب بلد العميل" />}
          action={<span className="sp-pill is-active">{rangeLabel}</span>}
        >
          <div className="sp-legend">
            {(data?.markets ?? []).map((m) => (
              <div key={m.country}>
                <Avatar name={m.country} size={30} />
                <span>{m.country}</span>
                <b>{m.bookings.toLocaleString('en-US')}</b>
              </div>
            ))}
            {(data?.markets ?? []).length === 0 && !loading && (
              <AdminEmpty
                title={<AdminText en="No market data in range" ar="لا بيانات أسواق في الفترة" />}
                copy={<AdminText en="Bookings created in range will appear here." ar="ستظهر هنا الحجوزات المنشأة في الفترة." />}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="sp-grid-dash">
        <Card
          title={<AdminText en="Popular tours" ar="الرحلات الأكثر طلبًا" />}
          sub={<AdminText en="Top sold tours in range (non-cancelled bookings)" ar="الأعلى مبيعًا في الفترة (الحجوزات غير الملغاة)" />}
          action={<span className="sp-pill is-active">{rangeLabel}</span>}
        >
          <div className="sp-legend">
            {(data?.topTours ?? []).map((t) => (
              <div key={`${t.slug}-${t.currency}`}>
                <span>{t.title}</span>
                <b>{t.lines.toLocaleString('en-US')} · {fmtMoney(t.volume, t.currency)}</b>
              </div>
            ))}
            {(data?.topTours ?? []).length === 0 && !loading && (
              <AdminEmpty
                title={<AdminText en="No tour sales in range" ar="لا مبيعات رحلات في الفترة" />}
                copy={<AdminText en="Sold booking lines in range will appear here." ar="ستظهر هنا بنود الحجوزات المباعة في الفترة." />}
              />
            )}
          </div>
        </Card>

        <Card
          title={<AdminText en="Request pipeline" ar="خط الطلبات" />}
          sub={<AdminText en="Open demand created in range" ar="الطلبات المنشأة في الفترة" />}
          action={<span className="sp-pill is-active">{rangeLabel}</span>}
        >
          <div className="sp-legend">
            <div>
              <span><AdminText en="Trip requests" ar="طلبات الرحلات" /></span>
              <b>{(data?.pipeline.tripRequests.total ?? 0).toLocaleString('en-US')}</b>
            </div>
            <div>
              <span><AdminText en="Car requests" ar="طلبات السيارات" /></span>
              <b>{(data?.pipeline.carRequests.total ?? 0).toLocaleString('en-US')}</b>
            </div>
            <div>
              <span><AdminText en="Event requests" ar="طلبات الفعاليات" /></span>
              <b>{(data?.pipeline.eventRequests.total ?? 0).toLocaleString('en-US')}</b>
            </div>
            <div>
              <span><AdminText en="Contact leads" ar="استفسارات التواصل" /></span>
              <b>{(data?.pipeline.enquiries.total ?? 0).toLocaleString('en-US')}</b>
            </div>
            <div>
              <span><AdminText en="Reviews pending moderation" ar="مراجعات بانتظار المراجعة" /></span>
              <b>{(data?.pipeline.reviews.pending ?? 0).toLocaleString('en-US')}</b>
            </div>
            <div>
              <span><AdminText en="Customers" ar="العملاء" /></span>
              <b>{(data?.pipeline.customers.total ?? 0).toLocaleString('en-US')}</b>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
