'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, Eye, EyeOff, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { events } from '@/data/content'
import { isCustomSlug, removeCustomItem, setEventHidden, useHiddenEvents, useLiveEvents } from '@/lib/admin-store'
import { getEventStatus, isEventPublished } from '@/lib/events'
import { requestsForEventSlug, useEventRequests } from '@/lib/event-request'

export default function EventsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('all')
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all')
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const liveEvents = useLiveEvents(events, { includeHidden: true })
  const hidden = useHiddenEvents()
  const requests = useEventRequests()

  const locations = useMemo(() => [...new Set(liveEvents.map((event) => event.location))], [liveEvents])
  const rows = useMemo(() => liveEvents
    .filter((event) => visibility === 'all' || (visibility === 'hidden' ? hidden.includes(event.slug) || event.isPublished === false : !hidden.includes(event.slug) && isEventPublished(event)))
    .filter((event) => location === 'all' || event.location === location)
    .filter((event) => `${event.title} ${event.location} ${event.date} ${event.category ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [liveEvents, location, query, visibility, hidden])

  const eventSort = useAdminTableSort(rows, {
    event: (row) => row.title,
    location: (row) => row.location,
    date: (row) => row.startDate ?? row.date,
    requests: (row) => requestsForEventSlug(requests, row.slug).length,
    status: (row) => (hidden.includes(row.slug) || row.isPublished === false ? 'hidden' : isCustomSlug(row.slug) ? 'custom' : 'published'),
  }, 'date', 'desc')
  const paging = usePagination(eventSort.sortedRows)
  const now = Date.now()
  const upcoming = liveEvents.filter((e) => { const s = getEventStatus(e, now); return (s === 'upcoming' || s === 'ongoing') && !hidden.includes(e.slug) && isEventPublished(e) }).length
  const hiddenCount = liveEvents.filter((e) => hidden.includes(e.slug) || e.isPublished === false).length
  const publishedCount = liveEvents.length - hiddenCount

  return <>
    <PageHead eyebrow="Content" title="Events" titleAr="الفعاليات" sub="Programs, inclusions, dates and event landing pages" subAr="البرامج والمشمول والمواعيد وصفحات الفعاليات" actions={<Link className="sp-btn primary" href="/admin/events/new"><Plus size={17} /> <AdminText en="New event" ar="فعالية جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Events" ar="الفعاليات" />, value: liveEvents.length, note: <AdminText en="Canonical + local customs" ar="أساسية + محلية" />, icon: CalendarCheck },
      { label: <AdminText en="Upcoming" ar="القادمة" />, value: upcoming, note: <AdminText en="Structured status" ar="حالة منظمة" />, icon: CalendarCheck, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: publishedCount, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: hiddenCount, note: <AdminText en="Admin only" ar="للإدارة فقط" />, icon: EyeOff, tone: 'orange' },
    ]} />
    <Card title={<AdminText en="All events" ar="كل الفعاليات" />} sub={<AdminText en={`${rows.length} of ${liveEvents.length} events shown`} ar={`عرض ${rows.length} من ${liveEvents.length} فعاليات`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بفعالية أو تاريخ أو موقع...' : 'Search event, date or location...'}>
          <SharedSelect value={location} onChange={setLocation} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الموقع' : 'Filter events by location'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل المواقع' : 'All locations' }, ...locations.map((item) => ({ value: item, label: item }))]} />
          <SharedSelect value={visibility} onChange={(next) => setVisibility(next as typeof visibility)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الظهور' : 'Filter by visibility'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'published', label: ar ? 'المنشورة' : 'Published' }, { value: 'hidden', label: ar ? 'المخفية' : 'Hidden' }]} />
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Event" ar="الفعالية" />} column="event" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Location" ar="الموقع" />} column="location" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Requests" ar="الطلبات" />} column="requests" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...eventSort} onSort={eventSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((event, index) => {
          const isHidden = hidden.includes(event.slug) || event.isPublished === false
          const reqCount = requestsForEventSlug(requests, event.slug).length
          return <tr key={event.slug}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><strong>{event.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{event.category ?? 'Event'}{isCustomSlug(event.slug) ? (ar ? ' · محلي' : ' · local') : ''}</small></td>
            <td>{event.location}</td><td>{event.date}</td>
            <td><Link href="/admin/event-requests">{reqCount} <AdminText en="requests" ar="طلبات" /></Link></td>
            <td><span className={`sp-status is-${isHidden ? 'cancelled' : 'confirmed'}`}>{isHidden ? (ar ? 'مخفية' : 'Hidden') : (ar ? 'منشورة' : 'Published')}</span></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${event.title}` : `Edit ${event.title}`} href={`/admin/events/new?slug=${encodeURIComponent(event.slug)}`} />
              <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${event.title}` : `View ${event.title}`} href={`/events/${event.slug}`} />
              <button type="button" className="sp-icon-btn" onClick={() => setEventHidden(event.slug, isHidden ? false : true)} aria-label={isHidden ? (ar ? `نشر ${event.title}` : `Publish ${event.title}`) : (ar ? `إخفاء ${event.title}` : `Hide ${event.title}`)} title={isHidden ? (ar ? 'نشر' : 'Publish') : (ar ? 'إخفاء' : 'Hide')}>{isHidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              {isCustomSlug(event.slug) && <button type="button" className="sp-delete-btn" onClick={() => setDeleteSlug(event.slug)}><Trash2 size={14} /> <AdminText en="Delete" ar="حذف" /></button>}
            </AdminTableActions></td>
          </tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No events found" ar="لا توجد فعاليات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <AdminConfirmDialog
      open={deleteSlug !== null}
      onClose={() => setDeleteSlug(null)}
      onConfirm={() => { if (deleteSlug) { setEventHidden(deleteSlug, false); removeCustomItem('events', deleteSlug) } setDeleteSlug(null) }}
      title={<AdminText en="Delete this local event?" ar="حذف هذه الفعالية المحلية؟" />}
      description={<AdminText en="Removes it from the admin list and public pages on this browser. Canonical events cannot be deleted. Use Hide instead." ar="تحذفها من قائمة الإدارة والصفحات العامة على هذا المتصفح. الفعاليات الأساسية لا تُحذف. استخدم الإخفاء." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      cancelLabel={<AdminText en="Keep" ar="تراجع" />}
      tone="danger"
    />
  </>
}
