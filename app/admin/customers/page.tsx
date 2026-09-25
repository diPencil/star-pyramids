'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CheckCircle2, CircleDollarSign, Eye, LogIn, MessageCircle, Pencil, Plus, ShoppingBag, UserCheck, UserX, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { bookings, type BookingRow, type BookingStatus } from '@/components/admin/admin-data'
import { isCustomerActive, removeCustomItem, setCustomerActive, startImpersonation, useLiveCollection, type AdminCustomer } from '@/lib/admin-store'

const NO_BASE: AdminCustomer[] = []

type DirectoryRow =
  | { kind: 'custom'; key: string; name: string; avatar?: string; customer: AdminCustomer }
  | { kind: 'booking'; key: string; name: string; avatar?: string; booking: BookingRow }

export default function CustomersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | BookingStatus>('all')
  const [deactivated, setDeactivated] = useState<string[]>([])
  const customCustomers = useLiveCollection('customers', NO_BASE)
  const unique = useMemo(() => [...new Map(bookings.map((booking) => [booking.customer, booking])).values()], [])

  const dirRows = useMemo<DirectoryRow[]>(() => {
    const customs: DirectoryRow[] = customCustomers
      .filter((c) => `${c.name} ${c.username} ${c.email} ${c.phone} ${c.country}`.toLowerCase().includes(query.trim().toLowerCase()))
      .map((c) => ({ kind: 'custom', key: c.slug, name: c.name, avatar: c.avatar, customer: c }) as DirectoryRow)
    const booked: DirectoryRow[] = unique
      .filter((booking) => status === 'all' || booking.status === status)
      .filter((booking) => `${booking.customer} ${booking.tour} ${booking.id}`.toLowerCase().includes(query.trim().toLowerCase()))
      .map((booking) => ({ kind: 'booking', key: booking.customer, name: booking.customer, avatar: booking.avatar, booking }) as DirectoryRow)
    return [...customs, ...booked]
  }, [customCustomers, unique, query, status])

  const rowActive = (row: DirectoryRow) =>
    row.kind === 'custom' ? isCustomerActive(row.customer) : !deactivated.includes(row.key)

  const customerSort = useAdminTableSort(dirRows, {
    customer: (row) => row.name,
    tour: (row) => (row.kind === 'custom' ? row.customer.country : row.booking.tour),
    channel: (row) => (row.kind === 'custom' ? 'direct' : row.booking.channel),
    total: (row) => (row.kind === 'custom' ? 0 : row.booking.total),
    status: (row) => (rowActive(row) ? 'active' : 'inactive'),
  }, 'customer', 'asc')
  const paging = usePagination(customerSort.sortedRows)
  const confirmedValue = bookings.filter((booking) => booking.status === 'confirmed').reduce((sum, booking) => sum + booking.total, 0)

  const toggleActive = (row: DirectoryRow) => {
    if (row.kind === 'custom') setCustomerActive(row.customer.slug, !isCustomerActive(row.customer))
    else setDeactivated((prev) => (prev.includes(row.key) ? prev.filter((k) => k !== row.key) : [...prev, row.key]))
  }

  const loginAs = (row: DirectoryRow) => {
    startImpersonation({
      name: row.name,
      email: row.kind === 'custom' ? row.customer.email : undefined,
      avatar: row.avatar,
    })
  }

  return <>
    <PageHead eyebrow="CRM" title="Customers" titleAr="العملاء" sub="Booking history, acquisition channels and customer value" subAr="سجل الحجوزات وقنوات الوصول وقيمة العملاء" actions={<Link className="sp-btn primary" href="/admin/customers/new"><Plus size={17} /> <AdminText en="New customer" ar="عميل جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Customers" ar="العملاء" />, value: unique.length + customCustomers.length, note: <AdminText en="Unique customer records" ar="سجلات عملاء فريدة" />, icon: Users },
      { label: <AdminText en="Bookings" ar="الحجوزات" />, value: bookings.length, note: <AdminText en="Across all customers" ar="عبر كل العملاء" />, icon: ShoppingBag, tone: 'orange' },
      { label: <AdminText en="Confirmed customers" ar="عملاء مؤكدون" />, value: bookings.filter((booking) => booking.status === 'confirmed').length, note: <AdminText en="Ready or completed" ar="جاهزة أو مكتملة" />, icon: CheckCircle2, tone: 'green' },
      { label: <AdminText en="Confirmed value" ar="قيمة المؤكد" />, value: `$${confirmedValue.toLocaleString('en-US')}`, note: <AdminText en="Current sample records" ar="سجلات تجريبية حالية" />, icon: CircleDollarSign, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Customer directory" ar="دليل العملاء" />} sub={<AdminText en={`${dirRows.length} customers shown`} ar={`عرض ${dirRows.length} عملاء`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعميل أو حجز أو رحلة...' : 'Search customer, booking or tour...'}>
        <select className="sp-filter-select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label={ar ? 'فلترة حسب حالة الحجز' : 'Filter customers by booking status'}>
          <option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option><option value="pending">{ar ? 'قيد الانتظار' : 'Pending'}</option><option value="confirmed">{ar ? 'مؤكدة' : 'Confirmed'}</option><option value="cancelled">{ar ? 'ملغاة' : 'Cancelled'}</option>
        </select>
      </AdminTableTools>
      {dirRows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Last tour" ar="آخر رحلة" />} column="tour" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Channel" ar="القناة" />} column="channel" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Total spent" ar="إجمالي الإنفاق" />} column="total" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><th><AdminText en="Actions" ar="إجراءات" /></th></tr></thead>
        <tbody>
          {paging.pageRows.map((row, index) => {
            const active = rowActive(row)
            const secondary = row.kind === 'custom' ? `${row.customer.username} · ${row.customer.phone}` : row.booking.id
            const tour = row.kind === 'custom' ? row.customer.country : row.booking.tour
            const channel = row.kind === 'custom' ? 'direct' : row.booking.channel
            const total = row.kind === 'custom' ? 0 : row.booking.total
            return <tr key={`${row.kind}-${row.key}`}>
              <td className="sp-row-number">{paging.from + index}</td>
              <td><span className="sp-cust"><Avatar name={row.name} src={row.avatar} size={34} online={active} /><span><strong>{row.name}</strong><small>{secondary}</small></span></span></td>
              <td>{tour}</td>
              <td><span className="sp-inline-meta"><MessageCircle size={14} />{channel}</span></td>
              <td>${total.toLocaleString('en-US')}</td>
              <td><StatusPill status={active ? (row.kind === 'custom' ? 'custom' : row.booking.status) : 'inactive'} /></td>
              <td><AdminTableActions>
                <AdminIconAction icon={Eye} label={ar ? `عرض ${row.name}` : `View ${row.name}`} href={`/admin/customers/${encodeURIComponent(row.kind === 'custom' ? row.customer.slug : row.key)}`} />
                <AdminIconAction icon={Pencil} label={ar ? `تعديل ${row.name}` : `Edit ${row.name}`} href={`/admin/customers/${encodeURIComponent(row.kind === 'custom' ? row.customer.slug : row.key)}/edit`} />
                <AdminIconAction icon={LogIn} label={ar ? `الدخول بحساب ${row.name}` : `Login as ${row.name}`} onClick={() => loginAs(row)} />
                <AdminIconAction icon={active ? UserX : UserCheck} label={active ? (ar ? `تعطيل ${row.name}` : `Deactivate ${row.name}`) : (ar ? `تفعيل ${row.name}` : `Activate ${row.name}`)} tone={active ? 'danger' : 'success'} onClick={() => toggleActive(row)} />
                {row.kind === 'custom' && <button type="button" className="sp-delete-btn" onClick={() => removeCustomItem('customers', row.customer.slug)}><AdminText en="Delete" ar="حذف" /></button>}
              </AdminTableActions></td>
            </tr>
          })}
        </tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No customers found" ar="لا يوجد عملاء" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {dirRows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
