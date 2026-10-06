'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, CircleDollarSign, Eye, ShoppingCart, XCircle } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { type BookingStatus, type StaffBooking } from '@/lib/booking'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'pending', en: 'Pending', ar: 'قيد الانتظار' },
  { id: 'confirmed', en: 'Confirmed', ar: 'مؤكدة' },
  { id: 'completed', en: 'Completed', ar: 'مكتملة' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

type Row = {
  reference: string
  customer: string
  tour: string
  date: string
  guests: number
  total: number
  status: BookingStatus
}

function toRow(booking: StaffBooking): Row {
  const first = booking.lines[0]
  const guests = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const date = booking.lines.map((line) => line.date).find((d) => d !== '') ?? booking.createdAt.slice(0, 10)
  return {
    reference: booking.reference,
    customer: booking.account?.name || booking.contact.name,
    tour: first?.title ?? '—',
    date,
    guests,
    total: booking.total,
    status: booking.status,
  }
}

/**
 * Admin bookings (Phase 2E). Real database-backed records from
 * `/api/admin/bookings`: list, search/filter/sort, and confirm/cancel
 * transitions. Detail (items, contact snapshot, totals, activity,
 * internal notes) lives at `/admin/bookings/[ref]`.
 */
export default function BookingsPage() {
  const ar = useAdminLocale() === 'ar'
  const [bookings, setBookings] = useState<StaffBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/bookings', { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as { bookings?: StaffBooking[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load bookings.')
        if (!cancelled && Array.isArray(data.bookings)) {
          setBookings(data.bookings)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load bookings.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => bookings.map(toRow), [bookings])
  const visible = useMemo(() => rows
    .filter((row) => filter === 'all' || row.status === filter)
    .filter((row) => `${row.reference} ${row.customer} ${row.tour}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, filter, query])
  const confirmedRevenue = rows.filter((row) => row.status === 'confirmed').reduce((sum, row) => sum + row.total, 0)
  const bookingSort = useAdminTableSort(visible, {
    customer: (row) => row.customer, tour: (row) => row.tour, date: (row) => row.date,
    guests: (row) => row.guests, total: (row) => row.total, status: (row) => row.status,
  }, 'date', 'desc')
  const paging = usePagination(bookingSort.sortedRows)

  const mutate = (reference: string, status: BookingStatus) => {
    fetch(`/api/admin/bookings/${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    })
      .then(async (res) => {
        const data = (await res.json()) as StaffBooking & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not update the booking.')
        setBookings((prev) => prev.map((b) => (b.reference === data.reference ? data : b)))
        setLoadError('')
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Could not update the booking.')
      })
  }

  return (
    <>
      <PageHead eyebrow="Orders" title="Bookings" titleAr="الحجوزات" sub="Follow-up, confirmation and invoicing" subAr="المتابعة والتأكيد والفواتير" />
      <AdminStats items={[
        { label: <AdminText en="All bookings" ar="كل الحجوزات" />, value: loading ? '…' : rows.length, note: <AdminText en="Stored bookings" ar="الحجوزات المحفوظة" />, icon: ShoppingCart },
        { label: <AdminText en="Needs follow-up" ar="تحتاج متابعة" />, value: loading ? '…' : rows.filter((row) => row.status === 'pending').length, note: <AdminText en="Pending confirmation" ar="بانتظار التأكيد" />, icon: CalendarClock, tone: 'orange' },
        { label: <AdminText en="Confirmed" ar="المؤكدة" />, value: loading ? '…' : rows.filter((row) => row.status === 'confirmed').length, note: <AdminText en="Ready for operations" ar="جاهزة للتشغيل" />, icon: CheckCircle2, tone: 'green' },
        { label: <AdminText en="Confirmed value" ar="قيمة المؤكد" />, value: loading ? '…' : `$${confirmedRevenue.toLocaleString('en-US')}`, note: <AdminText en="Server-calculated USD" ar="بالدولار المحسوب من الخادم" />, icon: CircleDollarSign, tone: 'violet' },
      ]} />
      <Card title={<AdminText en="All bookings" ar="كل الحجوزات" />} sub={<AdminText en={`${visible.length} of ${rows.length} bookings shown`} ar={`عرض ${visible.length} من ${rows.length} حجوزات`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بحجز أو عميل أو رحلة...' : 'Search booking, customer or tour...'}>
          <div className="sp-tabs">
            {statusTabs.map((status) => <button key={status.id} type="button" className={filter === status.id ? 'active' : ''} onClick={() => setFilter(status.id)}>{ar ? status.ar : status.en}</button>)}
          </div>
        </AdminTableTools>
        {loading ? <p><AdminText en="Loading stored bookings…" ar="جارٍ تحميل الحجوزات المحفوظة…" /></p>
          : loadError && !rows.length ? <AdminEmpty title={<AdminText en="Could not load bookings" ar="تعذر تحميل الحجوزات" />} copy={<AdminText en={loadError} ar={loadError} />} />
          : visible.length ? <AdminTableWrap><table className="sp-table">
            <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tour" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Guests" ar="الضيوف" />} column="guests" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Total" ar="الإجمالي" />} column="total" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...bookingSort} onSort={bookingSort.sortBy} /><th></th></tr></thead>
            <tbody>
              {paging.pageRows.map((b, index) => (
                <tr key={b.reference}>
                  <td className="sp-row-number">{paging.from + index}</td>
                  <td><span className="sp-cust"><Avatar name={b.customer} src="" size={32} /><span><strong>{b.customer}</strong><small>{b.reference}</small></span></span></td>
                  <td><Link href={`/admin/bookings/${encodeURIComponent(b.reference)}`}>{b.tour}</Link></td>
                  <td>{b.date}</td>
                  <td>{b.guests}</td>
                  <td>${b.total.toLocaleString('en-US')}</td>
                  <td><StatusPill status={b.status} /></td>
                  <td><AdminTableActions>
                    <AdminIconAction icon={Eye} label={ar ? `عرض الحجز ${b.reference}` : `View booking ${b.reference}`} href={`/admin/bookings/${encodeURIComponent(b.reference)}`} />
                    <AdminIconAction icon={CheckCircle2} label={ar ? `تأكيد ${b.reference}` : `Confirm ${b.reference}`} tone="success" disabled={b.status === 'confirmed' || b.status === 'completed'} onClick={() => mutate(b.reference, 'confirmed')} />
                    <AdminIconAction icon={XCircle} label={ar ? `إلغاء ${b.reference}` : `Cancel ${b.reference}`} tone="danger" disabled={b.status === 'cancelled' || b.status === 'completed'} onClick={() => mutate(b.reference, 'cancelled')} />
                  </AdminTableActions></td>
                </tr>
              ))}
            </tbody>
          </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No bookings found" ar="لا توجد حجوزات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {loadError && rows.length > 0 && <p role="alert">{loadError}</p>}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
