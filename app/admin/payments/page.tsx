'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, Clock3, CreditCard, Eye, ReceiptText } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { PAYMENT_STATUSES, paymentStatusLabel, type PaymentStatus, type StaffPayment } from '@/lib/payment'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  ...PAYMENT_STATUSES.map((status) => ({ id: status, en: status.replace(/_/g, ' '), ar: status })),
] as const

type Row = {
  reference: string
  booking: string
  customer: string
  amount: number
  paid: number
  status: PaymentStatus
  createdAt: string
}

function toRow(payment: StaffPayment): Row {
  return {
    reference: payment.reference,
    booking: payment.bookingReference,
    customer: payment.account?.name || payment.account?.email || '—',
    amount: payment.amount,
    paid: payment.amountPaid,
    status: payment.status,
    createdAt: payment.createdAt.slice(0, 10),
  }
}

/**
 * Admin payments (Phase 2F-A). Real database-backed records from
 * `/api/admin/payments`: list, search/filter/sort. Read-only: detail
 * (amounts, provider reference, history) lives at
 * `/admin/payments/[ref]`. No status editing exists in this phase.
 */
export default function PaymentsPage() {
  const ar = useAdminLocale() === 'ar'
  const [payments, setPayments] = useState<StaffPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | PaymentStatus>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/payments', { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as { payments?: StaffPayment[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load payments.')
        if (!cancelled && Array.isArray(data.payments)) {
          setPayments(data.payments)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load payments.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => payments.map(toRow), [payments])
  const visible = useMemo(() => rows
    .filter((row) => filter === 'all' || row.status === filter)
    .filter((row) => `${row.reference} ${row.booking} ${row.customer}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, filter, query])
  const collected = rows.filter((row) => row.status === 'paid' || row.status === 'partially_refunded' || row.status === 'refunded').reduce((sum, row) => sum + row.paid, 0)
  const paymentSort = useAdminTableSort(visible, {
    reference: (row) => row.reference, booking: (row) => row.booking, customer: (row) => row.customer,
    amount: (row) => row.amount, paid: (row) => row.paid, status: (row) => row.status, createdAt: (row) => row.createdAt,
  }, 'createdAt', 'desc')
  const paging = usePagination(paymentSort.sortedRows)

  return (
    <>
      <PageHead eyebrow="Orders" title="Payments" titleAr="المدفوعات" sub="Payment attempts, collection and history" subAr="محاولات الدفع والتحصيل والسجل" />
      <AdminStats items={[
        { label: <AdminText en="All payments" ar="كل المدفوعات" />, value: loading ? '…' : rows.length, note: <AdminText en="Stored payment records" ar="سجلات الدفع المحفوظة" />, icon: CreditCard },
        { label: <AdminText en="Awaiting provider" ar="بانتظار المزود" />, value: loading ? '…' : rows.filter((row) => row.status === 'pending' || row.status === 'processing').length, note: <AdminText en="Pending handoff" ar="بانتظار التحويل" />, icon: Clock3, tone: 'orange' },
        { label: <AdminText en="Collected" ar="المحصّل" />, value: loading ? '…' : `$${collected.toLocaleString('en-US')}`, note: <AdminText en="Server-recorded USD" ar="بالدولار المسجل من الخادم" />, icon: CircleDollarSign, tone: 'green' },
        { label: <AdminText en="Records" ar="السجلات" />, value: loading ? '…' : rows.length, note: <AdminText en="Immutable history" ar="سجل غير قابل للتعديل" />, icon: ReceiptText, tone: 'violet' },
      ]} />
      <Card title={<AdminText en="All payments" ar="كل المدفوعات" />} sub={<AdminText en={`${visible.length} of ${rows.length} payments shown`} ar={`عرض ${visible.length} من ${rows.length} مدفوعات`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بمرجع دفع أو حجز أو عميل...' : 'Search payment, booking or customer...'}>
          <div className="sp-tabs">
            {statusTabs.map((status) => <button key={status.id} type="button" className={filter === status.id ? 'active' : ''} onClick={() => setFilter(status.id as 'all' | PaymentStatus)}>{ar ? status.ar : status.en}</button>)}
          </div>
        </AdminTableTools>
        {loading ? <p><AdminText en="Loading stored payments…" ar="جارٍ تحميل المدفوعات المحفوظة…" /></p>
          : loadError && !rows.length ? <AdminEmpty title={<AdminText en="Could not load payments" ar="تعذر تحميل المدفوعات" />} copy={<AdminText en={loadError} ar={loadError} />} />
          : visible.length ? <AdminTableWrap><table className="sp-table">
            <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Payment" ar="الدفع" />} column="reference" {...paymentSort} onSort={paymentSort.sortBy} /><SortableTh label={<AdminText en="Booking" ar="الحجز" />} column="booking" {...paymentSort} onSort={paymentSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...paymentSort} onSort={paymentSort.sortBy} /><SortableTh label={<AdminText en="Amount" ar="المبلغ" />} column="amount" {...paymentSort} onSort={paymentSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...paymentSort} onSort={paymentSort.sortBy} /><SortableTh label={<AdminText en="Created" ar="أُنشئ" />} column="createdAt" {...paymentSort} onSort={paymentSort.sortBy} /><th></th></tr></thead>
            <tbody>
              {paging.pageRows.map((b, index) => (
                <tr key={b.reference}>
                  <td className="sp-row-number">{paging.from + index}</td>
                  <td><span className="sp-cust"><Avatar name={b.customer} src="" size={32} /><span><strong dir="ltr">{b.reference}</strong><small>{paymentStatusLabel(b.status, ar)}</small></span></span></td>
                  <td><Link href={`/admin/bookings/${encodeURIComponent(b.booking)}`}>{b.booking}</Link></td>
                  <td>{b.customer}</td>
                  <td>${b.amount.toLocaleString('en-US')}</td>
                  <td><StatusPill status={b.status} /></td>
                  <td>{b.createdAt}</td>
                  <td><AdminTableActions>
                    <AdminIconAction icon={Eye} label={ar ? `عرض الدفع ${b.reference}` : `View payment ${b.reference}`} href={`/admin/payments/${encodeURIComponent(b.reference)}`} />
                  </AdminTableActions></td>
                </tr>
              ))}
            </tbody>
          </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No payments found" ar="لا توجد مدفوعات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {loadError && rows.length > 0 && <p role="alert">{loadError}</p>}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
