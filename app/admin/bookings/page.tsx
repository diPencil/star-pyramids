'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, CircleDollarSign, ShoppingCart, XCircle } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { bookings, type BookingStatus } from '@/components/admin/admin-data'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'pending', en: 'Pending', ar: 'قيد الانتظار' },
  { id: 'confirmed', en: 'Confirmed', ar: 'مؤكدة' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

export default function BookingsPage() {
  const ar = useAdminLocale() === 'ar'
  const [rows, setRows] = useState(bookings)
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [channel, setChannel] = useState<'all' | 'site' | 'chat' | 'whatsapp'>('all')
  const [query, setQuery] = useState('')
  const visible = useMemo(() => rows
    .filter((row) => filter === 'all' || row.status === filter)
    .filter((row) => channel === 'all' || row.channel === channel)
    .filter((row) => `${row.id} ${row.customer} ${row.tour}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, filter, channel, query])
  const confirmedRevenue = rows.filter((row) => row.status === 'confirmed').reduce((sum, row) => sum + row.total, 0)
  const bookingSort = useAdminTableSort(visible, {
    customer: (row) => row.customer, tour: (row) => row.tour, date: (row) => row.date,
    guests: (row) => row.guests, total: (row) => row.total, status: (row) => row.status,
  }, 'date', 'desc')
  const paging = usePagination(bookingSort.sortedRows)

  const setStatus = (id: string, status: BookingStatus) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

  return (
    <>
      <PageHead eyebrow="Orders" title="Bookings" titleAr="الحجوزات" sub="Follow-up, confirmation and invoicing" subAr="المتابعة والتأكيد والفواتير" />
      <AdminStats items={[
        { label: <AdminText en="All bookings" ar="كل الحجوزات" />, value: rows.length, note: <AdminText en="Across every channel" ar="عبر كل القنوات" />, icon: ShoppingCart },
        { label: <AdminText en="Needs follow-up" ar="تحتاج متابعة" />, value: rows.filter((row) => row.status === 'pending').length, note: <AdminText en="Pending confirmation" ar="بانتظار التأكيد" />, icon: CalendarClock, tone: 'orange' },
        { label: <AdminText en="Confirmed" ar="المؤكدة" />, value: rows.filter((row) => row.status === 'confirmed').length, note: <AdminText en="Ready for operations" ar="جاهزة للتشغيل" />, icon: CheckCircle2, tone: 'green' },
        { label: <AdminText en="Confirmed value" ar="قيمة المؤكد" />, value: `$${confirmedRevenue.toLocaleString('en-US')}`, note: <AdminText en="Frontend sample data" ar="بيانات تجريبية للواجهة" />, icon: CircleDollarSign, tone: 'violet' },
      ]} />
      <Card title={<AdminText en="All bookings" ar="كل الحجوزات" />} sub={<AdminText en={`${visible.length} of ${rows.length} bookings shown`} ar={`عرض ${visible.length} من ${rows.length} حجوزات`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بحجز أو عميل أو رحلة...' : 'Search booking, customer or tour...'}>
          <select className="sp-filter-select" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)} aria-label={ar ? 'فلترة حسب القناة' : 'Filter by channel'}>
            <option value="all">{ar ? 'كل القنوات' : 'All channels'}</option><option value="site">{ar ? 'الموقع' : 'Website'}</option><option value="chat">{ar ? 'المحادثة المباشرة' : 'Live chat'}</option><option value="whatsapp">WhatsApp</option>
          </select>
          <div className="sp-tabs">
            {statusTabs.map((status) => <button key={status.id} type="button" className={filter === status.id ? 'active' : ''} onClick={() => setFilter(status.id)}>{ar ? status.ar : status.en}</button>)}
          </div>
        </AdminTableTools>
        {visible.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tour" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Guests" ar="الضيوف" />} column="guests" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Total" ar="الإجمالي" />} column="total" {...bookingSort} onSort={bookingSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...bookingSort} onSort={bookingSort.sortBy} /><th></th></tr></thead>
          <tbody>
            {paging.pageRows.map((b, index) => (
              <tr key={b.id}>
                <td className="sp-row-number">{paging.from + index}</td>
                <td><span className="sp-cust"><Avatar name={b.customer} src={b.avatar} size={32} /><span><strong>{b.customer}</strong><small>{b.id} · {b.channel}</small></span></span></td>
                <td>{b.tour}</td>
                <td>{b.date}</td>
                <td>{b.guests}</td>
                <td>${b.total.toLocaleString('en-US')}</td>
                <td><StatusPill status={b.status} /></td>
                <td><AdminTableActions>
                  <AdminIconAction icon={CheckCircle2} label={ar ? `تأكيد ${b.id}` : `Confirm ${b.id}`} tone="success" disabled={b.status === 'confirmed'} onClick={() => setStatus(b.id, 'confirmed')} />
                  <AdminIconAction icon={XCircle} label={ar ? `إلغاء ${b.id}` : `Cancel ${b.id}`} tone="danger" disabled={b.status === 'cancelled'} onClick={() => setStatus(b.id, 'cancelled')} />
                </AdminTableActions></td>
              </tr>
            ))}
          </tbody>
        </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No bookings found" ar="لا توجد حجوزات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
