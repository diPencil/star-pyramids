'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardList, Eye, Inbox } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { eventDisplayTitle, eventRequestStatusLabel, type EventRequestStatus, type StaffEventRequest } from '@/lib/event-request'
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

async function apiAdminList(): Promise<StaffEventRequest[]> {
  const res = await fetch('/api/admin/event-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load event requests.')
  const data = (await res.json()) as { requests?: StaffEventRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load event requests.')
  return data.requests
}

export default function EventRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [eventSlug, setEventSlug] = useState('all')
  const [requests, setRequests] = useState<StaffEventRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiAdminList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load event requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const eventOptions = useMemo(
    () => Array.from(new Map(requests.map((row) => [row.eventSlug, eventDisplayTitle(row.eventSlug, row.eventTitle)])).entries()),
    [requests],
  )

  const visible = useMemo(() => requests
    .filter((row) => status === 'all' || row.status === (status as EventRequestStatus))
    .filter((row) => eventSlug === 'all' || row.eventSlug === eventSlug)
    .filter((row) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return `${row.reference} ${row.eventTitle} ${row.contact.name} ${row.contact.email} ${row.contact.phone}`.toLowerCase().includes(q)
    }),
  [requests, status, eventSlug, query])

  const requestSort = useAdminTableSort<StaffEventRequest>(visible, {
    request: (row) => row.reference,
    event: (row) => row.eventTitle,
    customer: (row) => row.contact.name,
    attendees: (row) => row.attendees,
    submitted: (row) => row.createdAt,
    status: (row) => row.status,
  }, 'submitted', 'desc')
  const paging = usePagination(requestSort.sortedRows)

  const count = (s: EventRequestStatus) => requests.filter((row) => row.status === s).length

  return (
    <>
      <PageHead eyebrow="Events" title="Event Requests" titleAr="طلبات الفعاليات" sub="Attendance requests from the public event pages" subAr="طلبات حضور الفعاليات من الصفحات العامة" />
      <AdminStats items={[
        { label: <AdminText en="All requests" ar="كل الطلبات" />, value: loading ? '…' : requests.length, note: <AdminText en="Stored requests" ar="طلبات محفوظة" />, icon: ClipboardList },
        { label: <AdminText en="New" ar="جديدة" />, value: loading ? '…' : count('new'), note: <AdminText en="Awaiting review" ar="بانتظار المراجعة" />, icon: Inbox, tone: 'orange' },
        { label: <AdminText en="Reviewing" ar="قيد المراجعة" />, value: loading ? '…' : count('reviewing'), note: <AdminText en="Under staff review" ar="قيد مراجعة الفريق" />, icon: CalendarClock, tone: 'violet' },
        { label: <AdminText en="Approved" ar="المقبولة" />, value: loading ? '…' : count('approved'), note: <AdminText en="Approved requests" ar="طلبات مقبولة" />, icon: CheckCircle2, tone: 'green' },
      ]} />
      <Card
        title={<AdminText en="Event requests" ar="طلبات الفعاليات" />}
        sub={<AdminText en={`${visible.length} of ${requests.length} requests shown`} ar={`عرض ${visible.length} من ${requests.length} طلبات`} />}>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بالمرجع أو العميل أو الفعالية...' : 'Search ref, customer or event...'}>
          <SharedSelect value={status} onChange={(next) => setStatus(next as StatusFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الحالة' : 'Filter by status'} options={statusTabs.map((t) => ({ value: t.id, label: ar ? t.ar : t.en }))} />
          <SharedSelect value={eventSlug} onChange={setEventSlug} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الفعالية' : 'Filter by event'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل الفعاليات' : 'All events' }, ...eventOptions.map(([slug, title]) => ({ value: slug, label: title }))]} />
        </AdminTableTools>
        {loading ? (
          <AdminEmpty title={<AdminText en="Loading event requests…" ar="جارٍ تحميل طلبات الفعاليات…" />} />
        ) : loadError && !requests.length ? (
          <AdminEmpty title={<AdminText en="Could not load event requests" ar="تعذر تحميل طلبات الفعاليات" />} copy={<AdminText en={loadError} ar={loadError} />} />
        ) : visible.length ? (
          <AdminTableWrap>
            <table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Ref" ar="المرجع" />} column="request" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Event" ar="الفعالية" />} column="event" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Attendees" ar="الحضور" />} column="attendees" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Submitted" ar="أُرسل" />} column="submitted" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...requestSort} onSort={requestSort.sortBy} /><th /></tr></thead>
              <tbody>
                {paging.pageRows.map((row, index) => (
                  <tr key={row.reference}>
                    <td className="sp-row-number">{paging.from + index}</td>
                    <td dir="ltr"><strong>{row.reference}</strong></td>
                    <td><strong>{eventDisplayTitle(row.eventSlug, row.eventTitle)}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.eventDate}</small></td>
                    <td>{row.contact.name}<br /><small style={{ color: 'var(--sp-muted)' }} dir="ltr">{row.contact.email}</small></td>
                    <td>{row.attendees}</td>
                    <td><small>{new Date(row.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</small></td>
                    <td><span className={`sp-status is-${row.status}`}>{eventRequestStatusLabel(row.status, ar)}</span></td>
                    <td><AdminTableActions><AdminIconAction icon={Eye} label={ar ? `عرض ${row.reference}` : `View ${row.reference}`} href={`/admin/event-requests/detail?ref=${encodeURIComponent(row.reference)}`} /></AdminTableActions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrap>
        ) : (
          <AdminEmpty title={<AdminText en="No event requests found" ar="لا توجد طلبات فعاليات" />} copy={<AdminText en="Requests submitted from public event pages appear here." ar="الطلبات المرسلة من صفحات الفعاليات العامة تظهر هنا." />} />
        )}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
