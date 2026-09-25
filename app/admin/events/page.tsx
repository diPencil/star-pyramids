'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, MapPin, Pencil, Plus, Sparkles } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { events } from '@/data/content'
import { isCustomSlug, removeCustomItem, useLiveCollection } from '@/lib/admin-store'

export default function EventsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('all')
  const liveEvents = useLiveCollection('events', events)
  const locations = [...new Set(liveEvents.map((event) => event.location))]
  const rows = useMemo(() => liveEvents
    .filter((event) => location === 'all' || event.location === location)
    .filter((event) => `${event.title} ${event.location} ${event.date}`.toLowerCase().includes(query.trim().toLowerCase())), [liveEvents, location, query])
  const eventSort = useAdminTableSort(rows, {
    event: (row) => row.title,
    location: (row) => row.location,
    date: (row) => Date.parse(row.date) || row.date,
    program: (row) => row.program?.length ?? 0,
    status: (row) => isCustomSlug(row.slug) ? 'custom' : 'published',
  }, 'date', 'desc')
  const paging = usePagination(eventSort.sortedRows)

  return <>
    <PageHead eyebrow="Content" title="Events" titleAr="الفعاليات" sub="Programs, inclusions, dates and event landing pages" subAr="البرامج والمشمول والمواعيد وصفحات الفعاليات" actions={<Link className="sp-btn primary" href="/admin/events/new"><Plus size={17} /> <AdminText en="New event" ar="فعالية جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="All events" ar="كل الفعاليات" />, value: liveEvents.length, note: <AdminText en="Published event pages" ar="صفحات فعاليات منشورة" />, icon: CalendarCheck },
      { label: <AdminText en="Locations" ar="المواقع" />, value: locations.length, note: <AdminText en="Unique routes and cities" ar="مسارات ومدن فريدة" />, icon: MapPin, tone: 'orange' },
      { label: <AdminText en="With programs" ar="ببرامج مفصلة" />, value: liveEvents.filter((event) => event.program?.length).length, note: <AdminText en="Detailed schedules" ar="جداول مفصلة" />, icon: Sparkles, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: liveEvents.length, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All events" ar="كل الفعاليات" />} sub={<AdminText en={`${rows.length} of ${liveEvents.length} events shown`} ar={`عرض ${rows.length} من ${liveEvents.length} فعاليات`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بفعالية أو تاريخ أو موقع...' : 'Search event, date or location...'}>
        <select className="sp-filter-select" value={location} onChange={(event) => setLocation(event.target.value)} aria-label={ar ? 'فلترة حسب الموقع' : 'Filter events by location'}>
          <option value="all">{ar ? 'كل المواقع' : 'All locations'}</option>{locations.map((item) => <option key={item}>{item}</option>)}
        </select>
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Event" ar="الفعالية" />} column="event" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Location" ar="الموقع" />} column="location" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Program" ar="البرنامج" />} column="program" {...eventSort} onSort={eventSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...eventSort} onSort={eventSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((event, index) => <tr key={event.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><strong>{event.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{event.category ?? 'Event'}</small></td>
          <td>{event.location}</td><td>{event.date}</td><td>{event.program?.length ?? 0} <AdminText en="stages" ar="مراحل" /></td><td><StatusPill status={isCustomSlug(event.slug) ? 'custom' : 'published'} /></td>
          <td><AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${event.title}` : `Edit ${event.title}`} href={`/admin/events/new`} /><AdminIconAction icon={ExternalLink} label={ar ? `عرض ${event.title}` : `View ${event.title}`} href={`/events/${event.slug}`} />{isCustomSlug(event.slug) && <button type="button" className="sp-delete-btn" onClick={() => removeCustomItem('events', event.slug)}><AdminText en="Delete" ar="حذف" /></button>}</AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No events found" ar="لا توجد فعاليات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
