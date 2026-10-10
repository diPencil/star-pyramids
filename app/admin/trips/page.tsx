'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Anchor, ExternalLink, Eye, EyeOff, Layers3, MapPinned, Pencil, Plus, ShipWheel } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { invalidateToursCache } from '@/lib/tours-client'
import { isTourPublished } from '@/lib/tour-publish'

type TripRow = {
  slug: string
  title: string
  category: string
  location: string
  price: number | string
  duration: string
  deal?: unknown
  aliases?: string[]
  status?: string
}

export default function TripsPage() {
  const ar = useAdminLocale() === 'ar'
  const [cat, setCat] = useState<'all' | 'one-day-tours' | 'multi-days-tours' | 'nile-cruises' | 'shore-excursions'>('all')
  const [q, setQ] = useState('')
  const [tours, setTours] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')

  // DB-authoritative catalogue (no static fallback).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/tours', { credentials: 'same-origin' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load trips.')
        if (!cancelled) setTours(Array.isArray(data.tours) ? data.tours : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trips.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => {
    return tours
      .filter((t) => (cat === 'all' ? true : t.category === cat))
      .filter((t) => (q ? (t.title + t.location).toLowerCase().includes(q.toLowerCase()) : true))
  }, [tours, cat, q])
  const setPublished = async (slug: string, published: boolean) => {
    if (busySlug) return
    setBusySlug(slug)
    setActionError('')
    setActionOk('')
    try {
      const res = await fetch(`/api/tours/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: published ? 'published' : 'draft' }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to update visibility.')
      }
      setTours((current) => current.map((t) => (t.slug === slug ? { ...t, status: published ? 'published' : 'draft' } : t)))
      invalidateToursCache()
      setActionOk(
        published
          ? (ar ? `تم نشر "${slug}". ستظهر في الموقع العام.` : `"${slug}" published. It now appears on the public website.`)
          : (ar ? `تم إخفاء "${slug}". لن تظهر في الموقع العام.` : `"${slug}" unpublished. It is now hidden from the public website.`),
      )
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update visibility.')
    } finally {
      setBusySlug(null)
    }
  }

  const tripSort = useAdminTableSort(rows, {
    tour: (row) => row.title, category: (row) => row.category, location: (row) => row.location,
    price: (row) => Number(row.price), status: (row) => row.status ?? 'published',
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
          {['all', 'one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'].map((c) => (
            <button key={c} type="button" className={cat === c ? 'active' : ''} onClick={() => setCat(c as typeof cat)}>
              {ar ? ({'all': 'الكل', 'one-day-tours': 'رحلات اليوم الواحد', 'multi-days-tours': 'رحلات متعددة الأيام', 'nile-cruises': 'رحلات النيل', 'shore-excursions': 'رحلات الشواطئ'}[c] ?? c) : ({'all': 'All', 'one-day-tours': 'One day tours', 'multi-days-tours': 'Multi days tours', 'nile-cruises': 'Nile cruises', 'shore-excursions': 'Shore excursions'}[c] ?? c)}
            </button>
          ))}
          </div>
        </AdminTableTools>
        {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
        {actionOk ? <p role="status" style={{ color: '#0e9f6e', margin: '8px 0 0' }}>{actionOk}</p> : null}
        {loading ? <AdminEmpty title={<AdminText en="Loading trips…" ar="جارٍ تحميل الرحلات…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
        : error ? <AdminEmpty title={<AdminText en="Could not load trips" ar="تعذر تحميل الرحلات" />} copy={<AdminText en={error} ar={error} />} />
        : rows.length ? <AdminTableWrap><table className="sp-table">
          <thead>
            <tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tour" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Category" ar="التصنيف" />} column="category" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Location" ar="الموقع" />} column="location" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Price" ar="السعر" />} column="price" {...tripSort} onSort={tripSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...tripSort} onSort={tripSort.sortBy} /><th></th></tr>
          </thead>
          <tbody>
            {paging.pageRows.map((t, index) => (
              <tr key={t.slug}>
                <td className="sp-row-number">{paging.from + index}</td>
                <td><strong>{t.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{t.duration}</small></td>
                <td>{ar ? ({'all': 'الكل', 'one-day-tours': 'رحلات اليوم الواحد', 'multi-days-tours': 'رحلات متعددة الأيام', 'nile-cruises': 'رحلات النيل', 'shore-excursions': 'رحلات الشواطئ'}[t.category] ?? t.category) : ({'all': 'All', 'one-day-tours': 'One day tours', 'multi-days-tours': 'Multi days tours', 'nile-cruises': 'Nile cruises', 'shore-excursions': 'Shore excursions'}[t.category] ?? t.category)}</td>
                <td>{t.location}</td>
                <td>${String(t.price)}</td>
                <td><StatusPill status={isTourPublished(t) ? 'published' : 'hidden'} /></td>
                <td><AdminTableActions>
                  <AdminIconAction icon={Pencil} label={ar ? `تعديل ${t.title}` : `Edit ${t.title}`} href={`/admin/trips/builder?slug=${t.slug}`} />
                  <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${t.title} على الموقع` : `View ${t.title} on website`} href={`/egypt-tours/${t.slug}`} />
                  <button
                    type="button"
                    className="sp-icon-btn"
                    disabled={busySlug === t.slug}
                    aria-busy={busySlug === t.slug}
                    onClick={() => void setPublished(t.slug, !isTourPublished(t))}
                    aria-label={isTourPublished(t) ? (ar ? `إخفاء ${t.title}` : `Unpublish ${t.title}`) : (ar ? `نشر ${t.title}` : `Publish ${t.title}`)}
                    title={isTourPublished(t) ? (ar ? 'إخفاء' : 'Unpublish') : (ar ? 'نشر' : 'Publish')}
                  >
                    {isTourPublished(t) ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
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
