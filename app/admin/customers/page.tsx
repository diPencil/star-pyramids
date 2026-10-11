'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, CircleDollarSign, Eye, ShoppingBag, UserCheck, UserX, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { useAdminCurrency } from '@/components/admin/admin-currency'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { mutateCustomerStatus, useDbCustomersStatus, type DirectoryCustomer } from '@/lib/admin-customers-client'

const accountStatusMeta: Record<DirectoryCustomer['status'], { en: string; ar: string; color: string }> = {
  ACTIVE: { en: 'Active', ar: 'نشط', color: '#22c55e' },
  PENDING: { en: 'Pending', ar: 'بانتظار التفعيل', color: '#f59e0b' },
  SUSPENDED: { en: 'Suspended', ar: 'موقوف', color: '#ef4444' },
}

export default function CustomersPage() {
  const ar = useAdminLocale() === 'ar'
  // Display-only conversion of server USD amounts, like the storefront.
  const { formatUsd } = useAdminCurrency()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | DirectoryCustomer['status']>('all')
  const [actionError, setActionError] = useState('')
  const [successNote, setSuccessNote] = useState('')
  // DB-authoritative directory with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never mock rows
  // masquerading as database records.
  const { data, viewerPermissions, loading, error, retry, refresh } = useDbCustomersStatus()
  const liveCustomers = data ?? []
  const canManage = viewerPermissions.includes('customers.edit')

  const [statusTarget, setStatusTarget] = useState<{ customer: DirectoryCustomer; to: 'ACTIVE' | 'SUSPENDED' } | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusServerError, setStatusServerError] = useState('')

  const submitStatus = async () => {
    if (!statusTarget) return
    setStatusSaving(true)
    setStatusServerError('')
    try {
      await mutateCustomerStatus(statusTarget.customer.publicId, statusTarget.to)
      setStatusTarget(null)
      setSuccessNote(statusTarget.to === 'ACTIVE'
        ? (ar ? 'تم تفعيل العميل.' : 'Customer activated.')
        : (ar ? 'تم إيقاف العميل.' : 'Customer suspended.'))
      setActionError('')
      refresh()
    } catch (err) {
      setStatusServerError(err instanceof Error ? err.message : (ar ? 'تعذر تحديث الحالة.' : 'Could not update status.'))
    } finally {
      setStatusSaving(false)
    }
  }

  const rows = useMemo(() => liveCustomers
    .filter((customer) => status === 'all' || customer.status === status)
    .filter((customer) => `${customer.displayName} ${customer.email} ${customer.username ?? ''} ${customer.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [liveCustomers, query, status])

  const customerSort = useAdminTableSort(rows, {
    customer: (row) => row.displayName,
    bookings: (row) => row.bookingsCount,
    total: (row) => row.totalSpent,
    status: (row) => row.status,
  }, 'customer', 'asc')
  const paging = usePagination(customerSort.sortedRows)
  const bookingsCount = liveCustomers.reduce((sum, customer) => sum + customer.bookingsCount, 0)
  const confirmedValue = liveCustomers.reduce((sum, customer) => sum + customer.confirmedSpent, 0)
  const suspendedCount = liveCustomers.filter((customer) => customer.status === 'SUSPENDED').length

  return <>
    <PageHead eyebrow="CRM" title="Customers" titleAr="العملاء" sub="Booking history, acquisition channels and customer value" subAr="سجل الحجوزات وقنوات الوصول وقيمة العملاء" />
    <AdminStats items={[
      { label: <AdminText en="Customers" ar="العملاء" />, value: liveCustomers.length, note: <AdminText en="Registered accounts" ar="حسابات مسجلة" />, icon: Users },
      { label: <AdminText en="Bookings" ar="الحجوزات" />, value: bookingsCount, note: <AdminText en="Across all customers" ar="عبر كل العملاء" />, icon: ShoppingBag, tone: 'orange' },
      { label: <AdminText en="Confirmed customers" ar="عملاء مؤكدون" />, value: liveCustomers.filter((customer) => customer.confirmedSpent > 0).length, note: <AdminText en="With confirmed spend" ar="بإنفاق مؤكد" />, icon: CheckCircle2, tone: 'green' },
      { label: <AdminText en="Confirmed value" ar="قيمة المؤكد" />, value: formatUsd(confirmedValue), note: <AdminText en="Confirmed bookings total" ar="إجمالي الحجوزات المؤكدة" />, icon: CircleDollarSign, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Customer directory" ar="دليل العملاء" />} sub={<AdminText en={`${rows.length} of ${liveCustomers.length} customers shown`} ar={`عرض ${rows.length} من ${liveCustomers.length} عملاء`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعميل أو بريد أو هاتف...' : 'Search customer, email or phone...'}>
        <SharedSelect value={status} onChange={(next) => setStatus(next as typeof status)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب حالة الحساب' : 'Filter by account status'} options={[{ value: 'all', label: ar ? 'كل الحالات' : 'All statuses' }, { value: 'ACTIVE', label: ar ? 'نشط' : 'Active' }, { value: 'PENDING', label: ar ? 'بانتظار التفعيل' : 'Pending' }, { value: 'SUSPENDED', label: ar ? 'موقوف' : 'Suspended' }]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {successNote ? <p role="status" style={{ color: '#15803d', margin: '8px 0 0' }}>{successNote}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading customers…" ar="جارٍ تحميل العملاء…" />} copy={<AdminText en="Reading the customer directory." ar="تتم قراءة دليل العملاء." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load customers" ar="تعذر تحميل العملاء" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Bookings" ar="الحجوزات" />} column="bookings" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Total spent" ar="إجمالي الإنفاق" />} column="total" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><th><AdminText en="Actions" ar="إجراءات" /></th></tr></thead>
        <tbody>
          {paging.pageRows.map((customer, index) => {
            const meta = accountStatusMeta[customer.status] ?? accountStatusMeta.ACTIVE!
            const suspended = customer.status === 'SUSPENDED'
            return <tr key={customer.publicId}>
              <td className="sp-row-number">{paging.from + index}</td>
              <td><span className="sp-cust"><Avatar name={customer.displayName} size={34} online={customer.status === 'ACTIVE'} /><span><strong>{customer.displayName}</strong><small dir="ltr">{customer.email}</small></span></span></td>
              <td>{customer.bookingsCount}</td>
              <td>{formatUsd(customer.totalSpent)}</td>
              <td><span className="sp-inline-meta"><Circle size={8} fill={meta.color} color={meta.color} />{ar ? meta.ar : meta.en}</span></td>
              <td><AdminTableActions>
                <AdminIconAction icon={Eye} label={ar ? `عرض ${customer.displayName}` : `View ${customer.displayName}`} href={`/admin/customers/${encodeURIComponent(customer.publicId)}`} />
                {canManage ? <AdminIconAction icon={suspended ? UserCheck : UserX} label={suspended ? (ar ? `تفعيل ${customer.displayName}` : `Activate ${customer.displayName}`) : (ar ? `إيقاف ${customer.displayName}` : `Suspend ${customer.displayName}`)} tone={suspended ? 'success' : 'danger'} onClick={() => { setStatusServerError(''); setStatusTarget({ customer, to: suspended ? 'ACTIVE' : 'SUSPENDED' }) }} /> : null}
              </AdminTableActions></td>
            </tr>
          })}
        </tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No customers found" ar="لا يوجد عملاء" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>

    <AdminConfirmDialog
      open={statusTarget !== null}
      onClose={() => { if (!statusSaving) setStatusTarget(null) }}
      onConfirm={() => void submitStatus()}
      title={statusTarget?.to === 'ACTIVE'
        ? <AdminText en="Activate this customer?" ar="تفعيل هذا العميل؟" />
        : <AdminText en="Suspend this customer?" ar="إيقاف هذا العميل؟" />}
      description={statusTarget ? (statusTarget.to === 'ACTIVE'
        ? <AdminText en={`${statusTarget.customer.displayName} will be able to sign in again.`} ar={`سيتمكن ${statusTarget.customer.displayName} من تسجيل الدخول مجددًا.`} />
        : <AdminText en={`${statusTarget.customer.displayName} will be signed out everywhere and blocked from signing in.`} ar={`سيتم تسجيل خروج ${statusTarget.customer.displayName} من كل مكان ومنعه من الدخول.`} />) : undefined}
      confirmLabel={statusSaving
        ? <AdminText en="Working…" ar="جارٍ التنفيذ…" />
        : statusTarget?.to === 'ACTIVE'
          ? <AdminText en="Activate" ar="تفعيل" />
          : <AdminText en="Suspend" ar="إيقاف" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      tone={statusTarget?.to === 'ACTIVE' ? 'primary' : 'danger'}
      canConfirm={!statusSaving}
    >
      {statusServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{statusServerError}</p> : null}
    </AdminConfirmDialog>
  </>
}
