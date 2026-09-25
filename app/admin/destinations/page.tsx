'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Link2, MapPinned, Pencil, Plus, Sparkles } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { destinations } from '@/data/content'
import { isCustomSlug, removeCustomItem, useLiveCollection } from '@/lib/admin-store'

export default function DestinationsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const liveDestinations = useLiveCollection('destinations', destinations)
  const rows = useMemo(() => liveDestinations.filter((d) =>
    `${d.title} ${d.copy}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [liveDestinations, query])
  const linkedTours = liveDestinations.reduce((sum, d) => sum + d.detail.tourSlugs.length, 0)
  const experiences = liveDestinations.reduce((sum, d) => sum + d.detail.experiences.length, 0)
  const destinationSort = useAdminTableSort(rows, {
    destination: (row) => row.title,
    experiences: (row) => row.detail.experiences.length,
    tours: (row) => row.detail.tourSlugs.length,
    status: (row) => isCustomSlug(row.slug) ? 'custom' : 'published',
  }, 'destination', 'asc')
  const paging = usePagination(destinationSort.sortedRows)

  return <>
    <PageHead eyebrow="Catalogue" title="Destinations" titleAr="الوجهات" sub="Landing pages, experiences and linked tours" subAr="صفحات الهبوط والتجارب والرحلات المرتبطة" actions={<Link className="sp-btn primary" href="/admin/destinations/new"><Plus size={17} /> <AdminText en="New destination" ar="وجهة جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Destinations" ar="الوجهات" />, value: liveDestinations.length, note: <AdminText en="Published landing pages" ar="صفحات هبوط منشورة" />, icon: MapPinned },
      { label: <AdminText en="Linked tours" ar="الرحلات المرتبطة" />, value: linkedTours, note: <AdminText en="Tour connections" ar="روابط الرحلات" />, icon: Link2, tone: 'orange' },
      { label: <AdminText en="Experiences" ar="التجارب" />, value: experiences, note: <AdminText en="Curated highlights" ar="أبرز مختارات" />, icon: Sparkles, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: liveDestinations.length, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All destinations" ar="كل الوجهات" />} sub={<AdminText en={`${rows.length} of ${liveDestinations.length} shown`} ar={`عرض ${rows.length} من ${liveDestinations.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في الوجهات...' : 'Search destinations...'} />
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Destination" ar="الوجهة" />} column="destination" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Experiences" ar="التجارب" />} column="experiences" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Linked tours" ar="الرحلات المرتبطة" />} column="tours" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...destinationSort} onSort={destinationSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((d, index) => <tr key={d.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><strong>{d.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{d.copy.slice(0, 76)}...</small></td>
          <td>{d.detail.experiences.length}</td>
          <td>{d.detail.tourSlugs.length}</td>
          <td><StatusPill status={isCustomSlug(d.slug) ? 'custom' : 'published'} /></td>
          <td><AdminTableActions>
            <AdminIconAction icon={Pencil} label={ar ? `تعديل ${d.title}` : `Edit ${d.title}`} href={`/admin/destinations/new`} />
            <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${d.title}` : `View ${d.title}`} href={`/destinations/${d.slug}`} />
            {isCustomSlug(d.slug) && <button type="button" className="sp-delete-btn" onClick={() => removeCustomItem('destinations', d.slug)}><AdminText en="Delete" ar="حذف" /></button>}
          </AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No destinations found" ar="لا توجد وجهات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
