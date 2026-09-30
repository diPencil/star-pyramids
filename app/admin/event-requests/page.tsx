'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardList, Eye, Inbox } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { eventRequestStatusLabel, useEventRequests, type EventRequest, type EventRequestStatus } from '@/lib/event-request'
import { SharedSelect } from '@/components/shared-select'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'new', en: 'New', ar: 'جديدة' },
  { id: 'reviewing', en: 'Reviewing', ar: 'قيد المراجعة' },
  { id: 'approved', en: 'Approved', ar: 'مقبولة مبدئيًا' },
  { id: 'rejected', en: 'Rejected', ar: 'مرفوضة' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

type StatusFilter = (typeof statusTabs)[number]['id']

export default function EventRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [eventSlug, setEventSlug] = useState('all')
  const requests = useEventRequests()

  const eventOptions = useMemo(
    () => Array.from(new Map(requests.map((row) => [row.eventSlug, row.eventTitle])).entries()),
    [requests],
  )

  const visible = useMemo(() => requests
    .filter((row) => status === 'all' || row.status === (status as EventRequestStatus))
    .filter((row) => eventSlug === 'all' || row.eventSlug === eventSlug)
    .filter((row) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return `${row.localRef} ${row.eventTitle} ${row.name} ${row.email} ${row.phone}`.toLowerCase().includes(q)
    }),
  [requests, status, eventSlug, query])

  const requestSort = useAdminTableSort<EventRequest>(visible, {
    request: (row) => row.localRef,
    event: (row) => row.eventTitle,
    customer: (row) => row.name,
    attendees: (row) => row.attendees,
    submitted: (row) => row.createdAt,
    status: (row) => row.status,
  }, 'submitted', 'desc')
  const paging = usePagination(requestSort.sortedRows)

  const count = (s: EventRequestStatus) => requests.filter((row) => row.status === s).length

  return (
    <>
      <PageHead eyebrow="Events" title="Event Requests" titleAr="طلبات الفعاليات" sub="Local prototype attendance requests from the public event pages" subAr="طلبات حضور الفعاليات المحفوظة محليًا من الصفحات العامة" />
      <AdminStats items={[
        { label: <AdminText en="All requests" ar="كل الطلبات" />, value: requests.length, note: <AdminText en="Browser-local records" ar="سجلات محلية على المتصفح" />, icon: ClipboardList },
        { label: <AdminText en="New" ar="جديدة" />, value: count('new'), note: <AdminText en="Awaiting review" ar="بانتظار المراجعة" />, icon: Inbox, tone: 'orange' },
        { label: <AdminText en="Reviewing" ar="قيد المراجعة" />, value: count('reviewing'), note: <AdminText en="Under staff review" ar="قيد مراجعة الفريق" />, icon: CalendarClock, tone: 'violet' },
        { label: <AdminText en="Approved" ar="المقبولة" />, value: count('approved'), note: <AdminText en="Prototype approval only" ar="قبول مبدئي للمعاينة فقط" />, icon: CheckCircle2, tone: 'green' },
      ]} />
      <Card
        title={<AdminText en="Event requests" ar="طلبات الفعاليات" />}
        sub={<AdminText en={`${visible.length} of ${requests.length} requests shown · Browser-local prototype, not backend bookings`} ar={`عرض ${visible.length} من ${requests.length} طلبات · معاينة محلية وليست حجوزات خلفية`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالمرجع أو العميل أو الفعالية...' : 'Search ref, customer or event...'}>
          <SharedSelect value={status} onChange={(next) => setStatus(next as StatusFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الحالة' : 'Filter by status'} options={statusTabs.map((t) => ({ value: t.id, label: ar ? t.ar : t.en }))} />
          <SharedSelect value={eventSlug} onChange={setEventSlug} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الفعالية' : 'Filter by event'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل الفعاليات' : 'All events' }, ...eventOptions.map(([slug, title]) => ({ value: slug, label: title }))]} />
        </AdminTableTools>
        {visible.length ? (
          <AdminTableWrap>
            <table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Ref" ar="المرجع" />} column="request" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Event" ar="الفعالية" />} column="event" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Attendees" ar="الحضور" />} column="attendees" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Submitted" ar="أُرسل" />} column="submitted" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...requestSort} onSort={requestSort.sortBy} /><th /></tr></thead>
              <tbody>
                {paging.pageRows.map((row, index) => (
                  <tr key={row.localRef}>
                    <td className="sp-row-number">{paging.from + index}</td>
                    <td dir="ltr"><strong>{row.localRef}</strong></td>
                    <td><strong>{row.eventTitle}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.eventDate}</small></td>
                    <td>{row.name}<br /><small style={{ color: 'var(--sp-muted)' }} dir="ltr">{row.email}</small></td>
                    <td>{row.attendees}</td>
                    <td><small>{new Date(row.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</small></td>
                    <td><span className={`sp-status is-${row.status}`}>{eventRequestStatusLabel(row.status, ar)}</span></td>
                    <td><AdminTableActions><AdminIconAction icon={Eye} label={ar ? `عرض ${row.localRef}` : `View ${row.localRef}`} href={`/admin/event-requests/detail?ref=${encodeURIComponent(row.localRef)}`} /></AdminTableActions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrap>
        ) : (
          <AdminEmpty title={<AdminText en="No event requests found" ar="لا توجد طلبات فعاليات" />} copy={<AdminText en="Requests submitted from public event pages appear here on this browser." ar="الطلبات المرسلة من صفحات الفعاليات العامة تظهر هنا على هذا المتصفح." />} />
        )}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
