'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Anchor, ExternalLink, Layers3, MapPinned, Pencil, Plus, ShipWheel } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { tours } from '@/data/tours'

const cats = ['all', 'one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const

const catNames: Record<(typeof cats)[number], { en: string; ar: string }> = {
  all: { en: 'All', ar: 'الكل' },
  'one-day-tours': { en: 'One day tours', ar: 'رحلات اليوم الواحد' },
  'multi-days-tours': { en: 'Multi days tours', ar: 'رحلات متعددة الأيام' },
  'nile-cruises': { en: 'Nile cruises', ar: 'رحلات النيل' },
  'shore-excursions': { en: 'Shore excursions', ar: 'رحلات الشواطئ' },
}

export default function TripsPage() {
  const ar = useAdminLocale() === 'ar'
  const [cat, setCat] = useState<(typeof cats)[number]>('all')
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    return tours
      .filter((t) => (cat === 'all' ? true : t.category === cat))
      .filter((t) => (q ? (t.title + t.location).toLowerCase().includes(q.toLowerCase()) : true))
  }, [cat, q])
  const tripSort = useAdminTableSort(rows, {
    tour: (row) => row.title, category: (row) => row.category, location: (row) => row.location,
    price: (row) => row.price, status: (row) => row.deal ? 'active' : 'published',
  }, 'tour', 'asc')
  const paging = usePagination(tripSort.sortedRows)

  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title="Trips"
        titleAr="الرحلات"
        sub={`${tours.length} tours · prices, itinerary, media and reviews are edited in the Builder`}
        subAr={`${tours.length} رحلة · الأسعار والبرنامج والوسائط والتقييمات تعدل من المنشئ`}
        actions={<Link className="sp-btn primary" href="/admin/trips/builder"><Plus size={17} /> <AdminText en="Trip Builder" ar="منشئ الرحلات" /></Link>}
      />
      <AdminStats items={[
        { label: <AdminText en="One-day tours" ar="رحلات اليوم الواحد" />, value: tours.filter((tour) => tour.category === 'one-day-tours').length, note: <AdminText en="Focused daily experiences" ar="تجارب يومية مركزة" />, icon: MapPinned, tone: 'orange' },
        { label: <AdminText en="Multi-day packages" ar="باقات متعددة الأيام" />, value: tours.filter((tour) => tour.category === 'multi-days-tours').length, note: <AdminText en="Complete itineraries" ar="برامج متكاملة" />, icon: Layers3, tone: 'green' },
        { label: <AdminText en="Nile cruises" ar="رحلات النيل" />, value: tours.filter((tour) => tour.category === 'nile-cruises').length, note: <AdminText en="River journeys" ar="رحلات نيلية" />, icon: ShipWheel, tone: 'blue' },
        { label: <AdminText en="Shore excursions" ar="رحلات الشواطئ" />, value: tours.filter((tour) => tour.category === 'shore-excursions').length, note: <AdminText en="Port day trips" ar="رحلات الموانئ" />, icon: Anchor, tone: 'violet' },
      ]} />
      <Card title={<AdminText en="All trips" ar="كل الرحلات" />} sub={<AdminText en={`${rows.length} records match the current view`} ar={`${rows.length} سجل يطابق العرض الحالي`} />}>
        <AdminTableTools query={q} onQueryChange={setQ} placeholder={ar ? 'ابحث بعنوان الرحلة أو الموقع...' : 'Search trip title or location...'}>
          <div className="sp-tabs">
          {cats.map((c) => (
            <button key={c} type="button" className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>
              {ar ? catNames[c].ar : catNames[c].en}
            </button>
          ))}
          </div>
        </AdminTableTools>
        {rows.length ? <AdminTableWrap><table className="sp-table">
          <thead>
            <tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tour" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Category" ar="التصنيف" />} column="category" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Location" ar="الموقع" />} column="location" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Price" ar="السعر" />} column="price" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...tripSort} onSort={tripSort.sortBy} /><th></th></tr>
          </thead>
          <tbody>
            {paging.pageRows.map((t, index) => (
              <tr key={t.slug}>
                <td className="sp-row-number">{paging.from + index}</td>
                <td><strong>{t.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{t.duration}</small></td>
                <td>{ar ? catNames[t.category as (typeof cats)[number]]?.ar ?? t.category : t.category}</td>
                <td>{t.location}</td>
                <td>${t.price}</td>
                <td><StatusPill status={t.deal ? 'active' : 'published'} /></td>
                <td><AdminTableActions>
                  <AdminIconAction icon={Pencil} label={ar ? `تعديل ${t.title}` : `Edit ${t.title}`} href={`/admin/trips/builder?slug=${t.slug}`} />
                  <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${t.title} على الموقع` : `View ${t.title} on website`} href={`/egypt-tours/${t.slug}`} />
                </AdminTableActions></td>
              </tr>
            ))}
          </tbody>
        </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No trips found" ar="لا توجد رحلات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
    </>
  )
}
