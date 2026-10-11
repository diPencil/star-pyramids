'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, Eye, EyeOff, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { invalidateEventsCarsCache, useDbEventsStatus } from '@/lib/events-cars-client'
import { getEventStatus, isEventPublished } from '@/lib/events'
import { requestsForEventSlug, type StaffEventRequest } from '@/lib/event-request'

export default function EventsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('all')
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all')
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  // DB-authoritative catalogue with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never bootstrap
  // rows masquerading as database records.
  const { data, loading, error, retry } = useDbEventsStatus()
  const liveEvents = data ?? []
  const hidden = useMemo(() => liveEvents.filter((e) => e.isPublished === false).map((e) => e.slug), [liveEvents])
  const [requests, setRequests] = useState<StaffEventRequest[]>([])

  const setPublished = async (slug: string, published: boolean) => {
    setActionError('')
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: published }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to update visibility.')
      }
      invalidateEventsCarsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update visibility.')
    }
  }

  const removeEvent = async (slug: string) => {
    setActionError('')
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete event.')
      }
      invalidateEventsCarsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete event.')
    }
  }

  // Stored request counts per event (database-backed, like the catalogue).
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/event-requests', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { requests?: StaffEventRequest[] }
        if (!cancelled && Array.isArray(data.requests)) setRequests(data.requests)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const locations = useMemo(() => [...new Set(liveEvents.map((event) => event.location))], [liveEvents])
  const rows = useMemo(() => liveEvents
    .filter((event) => visibility === 'all' || (visibility === 'hidden' ? hidden.includes(event.slug) || event.isPublished === false : !hidden.includes(event.slug) && isEventPublished(event)))
    .filter((event) => location === 'all' || event.location === location)
    .filter((event) => `${event.title} ${event.location} ${event.date} ${event.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [liveEvents, location, query, visibility, hidden])

  const eventSort = useAdminTableSort(rows, {
    event: (row) => row.title,
    location: (row) => row.location,
    date: (row) => row.startDate ?? row.date,
    requests: (row) => requestsForEventSlug(requests, row.slug),
    status: (row) => (hidden.includes(row.slug) || row.isPublished === false ? 'hidden' : 'published'),
  }, 'date', 'desc')
  const paging = usePagination(eventSort.sortedRows)
  const now = Date.now()
  const upcoming = liveEvents.filter((e) => { const s = getEventStatus(e, now); return (s === 'upcoming' || s === 'ongoing') && !hidden.includes(e.slug) && isEventPublished(e) }).length
  const hiddenCount = liveEvents.filter((e) => hidden.includes(e.slug) || e.isPublished === false).length
  const publishedCount = liveEvents.length - hiddenCount

  return <>
    <PageHead eyebrow="Content" title="Events" titleAr="الفعاليات" sub="Programs, inclusions, dates and event landing pages" subAr="البرامج والمشمول والمواعيد وصفحات الفعاليات" actions={<Link className="sp-btn primary" href="/admin/events/new"><Plus size={17} /> <AdminText en="New event" ar="فعالية جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Events" ar="الفعاليات" />, value: liveEvents.length, note: <AdminText en="DB-backed catalogue" ar="كتالوج قاعدة البيانات" />, icon: CalendarCheck },
      { label: <AdminText en="Upcoming" ar="القادمة" />, value: upcoming, note: <AdminText en="Structured status" ar="حالة منظمة" />, icon: CalendarCheck, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: publishedCount, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: hiddenCount, note: <AdminText en="Admin only" ar="للإدارة فقط" />, icon: EyeOff, tone: 'orange' },
    ]} />
    <Card title={<AdminText en="All events" ar="كل الفعاليات" />} sub={<AdminText en={`${rows.length} of ${liveEvents.length} events shown`} ar={`عرض ${rows.length} من ${liveEvents.length} فعاليات`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بفعالية أو تاريخ أو موقع...' : 'Search event, date or location...'}>
          <SharedSelect value={location} onChange={setLocation} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الموقع' : 'Filter events by location'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل المواقع' : 'All locations' }, ...locations.map((item) => ({ value: item, label: item }))]} />
          <SharedSelect value={visibility} onChange={(next) => setVisibility(next as typeof visibility)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الظهور' : 'Filter by visibility'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'published', label: ar ? 'المنشورة' : 'Published' }, { value: 'hidden', label: ar ? 'المخفية' : 'Hidden' }]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading events…" ar="جارٍ تحميل الفعاليات…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load events" ar="تعذر تحميل الفعاليات" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Event" ar="الفعالية" />} column="event" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Location" ar="الموقع" />} column="location" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Requests" ar="الطلبات" />} column="requests" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...eventSort} onSort={eventSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((event, index) => {
          const isHidden = hidden.includes(event.slug) || event.isPublished === false
          const reqCount = requestsForEventSlug(requests, event.slug)
          return <tr key={event.slug}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><strong>{event.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{event.category ?? 'Event'}</small></td>
            <td>{event.location}</td><td>{event.date}</td>
            <td><Link href="/admin/event-requests">{reqCount} <AdminText en="requests" ar="طلبات" /></Link></td>
            <td><span className={`sp-status is-${isHidden ? 'cancelled' : 'confirmed'}`}>{isHidden ? (ar ? 'مخفية' : 'Hidden') : (ar ? 'منشورة' : 'Published')}</span></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${event.title}` : `Edit ${event.title}`} href={`/admin/events/new?slug=${encodeURIComponent(event.slug)}`} />
              <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${event.title}` : `View ${event.title}`} href={`/events/${event.slug}`} />
              <button type="button" className="sp-icon-btn" onClick={() => void setPublished(event.slug, isHidden ? true : false)} aria-label={isHidden ? (ar ? `نشر ${event.title}` : `Publish ${event.title}`) : (ar ? `إخفاء ${event.title}` : `Hide ${event.title}`)} title={isHidden ? (ar ? 'نشر' : 'Publish') : (ar ? 'إخفاء' : 'Hide')}>{isHidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <AdminIconAction icon={Trash2} label={ar ? `حذف ${event.title}` : `Delete ${event.title}`} tone="danger" onClick={() => setDeleteSlug(event.slug)} />
            </AdminTableActions></td>
          </tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No events found" ar="لا توجد فعاليات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <AdminConfirmDialog
      open={deleteSlug !== null}
      onClose={() => setDeleteSlug(null)}
      onConfirm={() => { if (deleteSlug) { void removeEvent(deleteSlug) } setDeleteSlug(null) }}
      title={<AdminText en="Delete this event?" ar="حذف هذه الفعالية؟" />}
      description={<AdminText en="Removes it from the admin list and public pages everywhere. Requests already submitted keep their history." ar="تحذفها من قائمة الإدارة والصفحات العامة في كل مكان. الطلبات المُرسلة تحتفظ بسجلها." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      cancelLabel={<AdminText en="Keep" ar="تراجع" />}
      tone="danger"
    />
  </>
}
