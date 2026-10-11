'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Link2, MapPinned, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { useDbDestinationsStatus } from '@/lib/catalogue-client'

export default function DestinationsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [removeError, setRemoveError] = useState('')
  // DB-authoritative catalogue with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never bootstrap
  // rows masquerading as database records.
  const { data, loading, error, retry } = useDbDestinationsStatus()
  const liveDestinations = data ?? []
  const removeDestination = async (slug: string) => {
    setRemoveError('')
    try {
      const res = await fetch(`/api/destinations/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete destination.')
      }
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to delete destination.')
    }
  }
  const rows = useMemo(() => liveDestinations.filter((d) =>
    `${d.title} ${d.nameAr ?? ''} ${d.copy}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [liveDestinations, query])
  const linkedTours = liveDestinations.reduce((sum, d) => sum + d.detail.tourSlugs.length, 0)
  const experiences = liveDestinations.reduce((sum, d) => sum + d.detail.experiences.length, 0)
  const published = liveDestinations.filter((d) => d.isPublished !== false).length
  const destinationSort = useAdminTableSort(rows, {
    destination: (row) => row.title,
    experiences: (row) => row.detail.experiences.length,
    tours: (row) => row.detail.tourSlugs.length,
    oneday: (row) => row.showInOneDayTours ? 'one-day' : 'editorial',
    status: (row) => row.isPublished === false ? 'hidden' : 'published',
  }, 'destination', 'asc')
  const paging = usePagination(destinationSort.sortedRows)

  return <>
    <PageHead eyebrow="Catalogue" title="Destinations" titleAr="الوجهات" sub="Landing pages, experiences and linked tours" subAr="صفحات الهبوط والتجارب والرحلات المرتبطة" actions={<Link className="sp-btn primary" href="/admin/destinations/new"><Plus size={17} /> <AdminText en="New destination" ar="وجهة جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Destinations" ar="الوجهات" />, value: liveDestinations.length, note: <AdminText en="Published landing pages" ar="صفحات هبوط منشورة" />, icon: MapPinned },
      { label: <AdminText en="Linked tours" ar="الرحلات المرتبطة" />, value: linkedTours, note: <AdminText en="Tour connections" ar="روابط الرحلات" />, icon: Link2, tone: 'orange' },
      { label: <AdminText en="Experiences" ar="التجارب" />, value: experiences, note: <AdminText en="Curated highlights" ar="أبرز مختارات" />, icon: Sparkles, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: published, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All destinations" ar="كل الوجهات" />} sub={<AdminText en={`${rows.length} of ${liveDestinations.length} shown`} ar={`عرض ${rows.length} من ${liveDestinations.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في الوجهات...' : 'Search destinations...'} />
      {removeError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{removeError}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading destinations…" ar="جارٍ تحميل الوجهات…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load destinations" ar="تعذر تحميل الوجهات" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Destination" ar="الوجهة" />} column="destination" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Experiences" ar="التجارب" />} column="experiences" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Linked tours" ar="الرحلات المرتبطة" />} column="tours" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="One Day Tours" ar="رحلات اليوم الواحد" />} column="oneday" {...destinationSort} onSort={destinationSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...destinationSort} onSort={destinationSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((d, index) => <tr key={d.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><strong>{d.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{d.copy.slice(0, 76)}...</small></td>
          <td>{d.detail.experiences.length}</td>
          <td>{d.detail.tourSlugs.length}</td>
          <td>{d.showInOneDayTours ? <StatusPill status="active" /> : <span style={{ color: 'var(--sp-muted)' }}>-</span>}</td>
          <td><StatusPill status={d.isPublished === false ? 'hidden' : 'published'} /></td>
          <td><AdminTableActions>
            <AdminIconAction icon={Pencil} label={ar ? `تعديل ${d.title}` : `Edit ${d.title}`} href={`/admin/destinations/new?slug=${d.slug}`} />
            <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${d.title}` : `View ${d.title}`} href={d.showInDestinations === false ? `/egypt-tours/one-day-tours/${d.slug}` : `/destinations/${d.slug}`} />
            <AdminIconAction icon={Trash2} label={ar ? `حذف ${d.title}` : `Delete ${d.title}`} tone="danger" onClick={() => void removeDestination(d.slug)} />
          </AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No destinations found" ar="لا توجد وجهات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
