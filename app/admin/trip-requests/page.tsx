'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, ClipboardList, Eye, Inbox, Rocket } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { destinations } from '@/data/content'
import { findTour } from '@/data/tours'
import { SharedSelect } from '@/components/shared-select'
import { tripRequestStatusLabel, useTripRequests, type TripRequest, type TripRequestStatus } from '@/lib/trip-request'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'new', en: 'New', ar: 'جديدة' },
  { id: 'reviewing', en: 'Reviewing', ar: 'قيد المراجعة' },
  { id: 'proposal_ready', en: 'Proposal ready', ar: 'العرض جاهز' },
  { id: 'approved', en: 'Approved', ar: 'مقبول' },
  { id: 'rejected', en: 'Rejected', ar: 'مرفوض' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغي' },
] as const

type StatusFilter = (typeof statusTabs)[number]['id']

function routeLabel(row: TripRequest): string {
  if (row.customTitle) return row.customTitle
  if (row.tourSlug) return findTour(row.tourSlug)?.title ?? row.tourSlug
  if (row.destinationSlug) return destinations.find((d) => d.slug === row.destinationSlug)?.title ?? row.destinationSlug
  return ''
}

function dateLabel(row: TripRequest): string {
  if (row.preferredFrom && row.preferredTo && row.preferredFrom !== row.preferredTo) return `${row.preferredFrom} → ${row.preferredTo}`
  return row.preferredFrom || row.preferredTo || ''
}

export default function TripRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [route, setRoute] = useState('all')
  const requests = useTripRequests()

  const routeOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => routeLabel(row)).filter(Boolean))).sort(),
    [requests],
  )

  const visible = useMemo(() => requests
    .filter((row) => status === 'all' || row.status === (status as TripRequestStatus))
    .filter((row) => route === 'all' || routeLabel(row) === route)
    .filter((row) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return `${row.localRef} ${row.contact.name} ${row.contact.email} ${row.contact.phone} ${routeLabel(row)}`.toLowerCase().includes(q)
    }),
  [requests, status, route, query])

  const requestSort = useAdminTableSort<TripRequest>(visible, {
    request: (row) => row.localRef,
    customer: (row) => row.contact.name,
    route: (row) => routeLabel(row),
    dates: (row) => row.preferredFrom || row.preferredTo,
    travelers: (row) => row.adults + row.children + row.infants,
    budget: (row) => row.budgetMax,
    submitted: (row) => row.createdAt,
    status: (row) => row.status,
  }, 'submitted', 'desc')
  const paging = usePagination(requestSort.sortedRows)

  const count = (s: TripRequestStatus) => requests.filter((row) => row.status === s).length

  return (
    <>
      <PageHead eyebrow="Requests" title="Trip Requests" titleAr="طلبات الرحلات" sub="Browser-local custom-trip requests from the website planner and customer accounts" subAr="طلبات الرحلات المخصصة المحفوظة محليًا من مخطط الموقع وحسابات العملاء" />
      <AdminStats items={[
        { label: <AdminText en="All requests" ar="كل الطلبات" />, value: requests.length, note: <AdminText en="Browser-local records" ar="سجلات محلية على المتصفح" />, icon: ClipboardList },
        { label: <AdminText en="New" ar="جديدة" />, value: count('new'), note: <AdminText en="Awaiting review" ar="بانتظار المراجعة" />, icon: Inbox, tone: 'orange' },
        { label: <AdminText en="Reviewing" ar="قيد المراجعة" />, value: count('reviewing'), note: <AdminText en="Under staff review" ar="قيد مراجعة الفريق" />, icon: CalendarClock, tone: 'violet' },
        { label: <AdminText en="Proposal ready" ar="العرض جاهز" />, value: count('proposal_ready'), note: <AdminText en="Ready for decision" ar="جاهز للقرار" />, icon: Rocket, tone: 'green' },
      ]} />
      <Card
        title={<AdminText en="Trip requests" ar="طلبات الرحلات" />}
        sub={<AdminText en={`${visible.length} of ${requests.length} requests shown · Browser-local prototype, not backend data`} ar={`عرض ${visible.length} من ${requests.length} طلبات · معاينة محلية وليست بيانات خلفية`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالمرجع أو العميل أو الوجهة...' : 'Search ref, customer or destination...'}>
          <SharedSelect value={status} onChange={(next) => setStatus(next as StatusFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الحالة' : 'Filter by status'} options={statusTabs.map((t) => ({ value: t.id, label: ar ? t.ar : t.en }))} />
          <SharedSelect value={route} onChange={setRoute} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب المسار' : 'Filter by route'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل المسارات' : 'All routes' }, ...routeOptions.map((label) => ({ value: label, label }))]} />
        </AdminTableTools>
        {visible.length ? (
          <AdminTableWrap>
            <table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Ref" ar="المرجع" />} column="request" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Route" ar="المسار" />} column="route" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Dates" ar="التواريخ" />} column="dates" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Travelers" ar="المسافرون" />} column="travelers" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Budget" ar="الميزانية" />} column="budget" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Created" ar="أُنشئ" />} column="submitted" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...requestSort} onSort={requestSort.sortBy} /><th /></tr></thead>
              <tbody>
                {paging.pageRows.map((row, index) => (
                  <tr key={row.localRef}>
                    <td className="sp-row-number">{paging.from + index}</td>
                    <td dir="ltr"><strong>{row.localRef}</strong></td>
                    <td>{row.contact.name || (ar ? 'بدون اسم' : 'No name')}<br /><small style={{ color: 'var(--sp-muted)' }} dir="ltr">{row.contact.email}</small></td>
                    <td><strong>{routeLabel(row) || (ar ? 'رحلة مخصصة' : 'Custom trip')}</strong></td>
                    <td><span dir="ltr">{dateLabel(row) || (ar ? 'موعد مرن' : 'Flexible')}</span></td>
                    <td>{row.adults + row.children + row.infants}</td>
                    <td><span dir="ltr">{row.budgetMin.toLocaleString('en-US')} - {row.budgetMax.toLocaleString('en-US')} {row.currency}</span></td>
                    <td><small>{new Date(row.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</small></td>
                    <td><span className={`sp-status is-${row.status}`}>{tripRequestStatusLabel(row.status, ar)}</span></td>
                    <td><AdminTableActions><AdminIconAction icon={Eye} label={ar ? `عرض ${row.localRef}` : `View ${row.localRef}`} href={`/admin/trip-requests/detail?ref=${encodeURIComponent(row.localRef)}`} /></AdminTableActions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrap>
        ) : (
          <AdminEmpty title={<AdminText en="No trip requests found" ar="لا توجد طلبات رحلات" />} copy={<AdminText en="Custom-trip requests created from the website planner or a customer account appear here on this browser." ar="طلبات الرحلات المخصصة المنشأة من مخطط الموقع أو حساب عميل تظهر هنا على هذا المتصفح." />} />
        )}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
