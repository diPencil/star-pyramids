'use client'

import Link from 'next/link'
import { BarChart3, CalendarCheck, Eye, ShoppingCart, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminTableWrap, AdminText, Avatar, Card, Delta, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { RevenueTrend } from '@/components/admin/revenue-trend'
import { bookings, bookingHabits, dashboardStats, markets, revenueDaily, revenueMonthly, revenueWeekly, tourSplit } from '@/components/admin/admin-data'
import { tours } from '@/data/tours'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'

const maxBar = 65

function Donut() {
  const total = tourSplit.reduce((s, t) => s + t.value, 0)
  const colors = ['#2b5ce6', '#f7951d', '#e11d48', '#cbd5e1']
  let acc = 0
  const segs = tourSplit.map((t, i) => {
    const frac = t.value / total
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
            strokeDasharray={`${(s.to - s.from) * c - 6} ${c}`}
            strokeDashoffset={-s.from * c + c * 0.25}
          />
        ))}
      </svg>
      <div>
        <span className="sp-donut-num">{dashboardStats.totalProducts.toLocaleString('en-US')}</span>
        <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12 }}><AdminText en="Products Sales" ar="مبيعات المنتجات" /></p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const ar = useAdminLocale() === 'ar'
  const liveTours = tours.length
  const seenTotal = bookingHabits.reduce((s, b) => s + b.seen, 0)
  const bookedTotal = bookingHabits.reduce((s, b) => s + b.booked, 0)
  const latestBookingSort = useAdminTableSort(bookings.slice(0, 5), {
    customer: (booking) => booking.customer,
    tour: (booking) => booking.tour,
    date: (booking) => Date.parse(booking.date),
    total: (booking) => booking.total,
    status: (booking) => booking.status,
  }, 'date', 'desc')
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

      <div className="sp-kpis">
        <section className="sp-card sp-kpi blue">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><ShoppingCart size={19} /></span>
            <Delta value={dashboardStats.revenueDelta} />
          </div>
          <small><AdminText en="Total Revenue" ar="إجمالي الإيرادات" /></small>
          <strong>${dashboardStats.revenue.toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot"><AdminText en="Products vs last month" ar="المنتجات مقارنة بالشهر الماضي" /></div>
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><CalendarCheck size={19} /></span>
            <Delta value={dashboardStats.bookingsDelta} />
          </div>
          <small><AdminText en="Total Bookings" ar="إجمالي الحجوزات" /></small>
          <strong>{dashboardStats.bookings.toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot"><AdminText en="Orders vs last month" ar="الطلبات مقارنة بالشهر الماضي" /></div>
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><Eye size={19} /></span>
            <Delta value={dashboardStats.visitorsDelta} />
          </div>
          <small><AdminText en="Visitors" ar="الزوار" /></small>
          <strong>{dashboardStats.visitors.toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot"><AdminText en="Users vs last month" ar="المستخدمون مقارنة بالشهر الماضي" /></div>
        </section>
        <section className="sp-card sp-kpi">
          <div className="sp-kpi-top">
            <span className="sp-kpi-ic"><Users size={19} /></span>
            <Delta value={dashboardStats.soldTripsDelta} />
          </div>
          <small><AdminText en="Total Sold Trips" ar="إجمالي الرحلات المباعة" /></small>
          <strong>{dashboardStats.soldTrips.toLocaleString('en-US')}</strong>
          <div className="sp-kpi-foot"><AdminText en="Products vs last month" ar="المنتجات مقارنة بالشهر الماضي" /></div>
        </section>
      </div>

      <div className="sp-grid-dash">
        <Card
          title={
            <span className="sp-card-title-row">
              <span className="sp-card-ic"><BarChart3 size={18} /></span><AdminText en="Booking Habits" ar="عادات الحجز" />
            </span>
          }
          sub={<AdminText en="Seen trip vs booked per month" ar="الرحلات المشاهدة مقابل المحجوزة شهريا" />}
          action={<span className="sp-pill is-active"><AdminText en="This year" ar="هذه السنة" /></span>}
        >
          <div className="sp-legend-pills">
            <span className="sp-legend-pill"><i style={{ background: '#ffd9a8' }} /><AdminText en={`Seen · ${seenTotal}k`} ar={`المشاهدة · ${seenTotal}k`} /></span>
            <span className="sp-legend-pill"><i style={{ background: '#163a96' }} /><AdminText en={`Booked · ${bookedTotal}k`} ar={`المحجوز · ${bookedTotal}k`} /></span>
          </div>
          <div className="sp-bars">
            {bookingHabits.map((b) => (
              <div key={b.month} className="sp-bar-col">
                <div className="sp-bar-pair">
                  <i style={{ height: `${(b.seen / maxBar) * 170}px` }} title={ar ? `مشاهدة ${b.seen}k` : `Seen ${b.seen}k`} />
                  <i className="b" style={{ height: `${(b.booked / maxBar) * 170}px` }} title={ar ? `محجوز ${b.booked}k` : `Booked ${b.booked}k`} />
                </div>
                <span>{b.month}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title={<AdminText en="Tour Statistic" ar="إحصائيات الرحلات" />}
          sub={<AdminText en="Track your product sales" ar="تابع مبيعات منتجاتك" />}
          action={<span className="sp-pill is-active"><AdminText en="Today" ar="اليوم" /></span>}
        >
          <Donut />
          <div className="sp-legend">
            {tourSplit.map((t) => (
              <div key={t.label}>
                <span>{t.label}</span>
                <b>{t.value.toLocaleString('en-US')}</b>
                <Delta value={t.delta} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <RevenueTrend monthly={revenueMonthly} weekly={revenueWeekly} daily={revenueDaily} />

      <div className="sp-grid-dash">
        <Card
          title={<AdminText en="Latest bookings" ar="أحدث الحجوزات" />}
          sub={<AdminText en="Bookings needing follow-up first" ar="الحجوزات التي تحتاج متابعة أولا" />}
          action={<Link className="sp-btn" href="/admin/bookings"><AdminText en="View all" ar="عرض الكل" /></Link>}
        >
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
        </Card>

        <Card
          title={<AdminText en="Bookings by Markets" ar="الحجوزات حسب الأسواق" />}
          sub={<AdminText en="Track customer by locations" ar="تابع العملاء حسب المواقع" />}
          action={<span className="sp-pill is-active"><AdminText en="Today" ar="اليوم" /></span>}
        >
          <div className="sp-legend">
            {markets.map((m) => (
              <div key={m.country}>
                <Avatar name={m.country} size={30} />
                <span>{m.country}</span>
                <b>{m.bookings.toLocaleString('en-US')}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
