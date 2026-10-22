'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Armchair, CarFront, ExternalLink, Eye, EyeOff, Gauge, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { invalidateEventsCarsCache, useDbCarsStatus } from '@/lib/events-cars-client'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { toast } from '@/components/admin/admin-toaster'

export default function CarsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [transmission, setTransmission] = useState('all')
  const [removeTarget, setRemoveTarget] = useState<{ slug: string; title: string } | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState('')
  // Confirmed transfer bookings per assigned vehicle. A separate staff-only
  // endpoint keeps the public list payload lean; missing stats render as
  // dashes instead of silently implying zero bookings.
  const [stats, setStats] = useState<{ totalConfirmedBookings: number; bookingsByVehicle: Record<string, number> } | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/cars/stats', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('stats unavailable'))))
      .then((body) => { if (!cancelled) setStats(body.stats) })
      .catch(() => { if (!cancelled) setStats(null) })
    return () => { cancelled = true }
  }, [])
  const bookingsFor = (slug: string) => stats?.bookingsByVehicle?.[slug] ?? 0
  // DB-authoritative fleet with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never bootstrap
  // rows masquerading as database records.
  const { data, loading, error, retry, refresh } = useDbCarsStatus()
  const liveCars = data ?? []
  const isHidden = (slug: string) => liveCars.find((car) => car.slug === slug)?.isPublished === false
  const visibility = (slug: string) => (isHidden(slug) ? 'hidden' : 'active')
  const setPublished = async (slug: string, published: boolean) => {
    const label = liveCars.find((car) => car.slug === slug)?.title ?? slug
    const dedupeKey = `car-publish-${slug}`
    try {
      const res = await fetch(`/api/cars/${encodeURIComponent(slug)}`, {
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
      toast.success(
        published
          ? (ar ? `تم إظهار "${label}" على الموقع العام.` : `"${label}" is now visible on the public fleet page.`)
          : (ar ? `تم إخفاء "${label}" عن الموقع العام.` : `"${label}" is now hidden from the public fleet page.`),
        { dedupeKey },
      )
      // Refresh from the DB source of truth without a full page reload.
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update visibility.', { dedupeKey })
    }
  }
  const removeCar = async () => {
    if (!removeTarget || removeBusy) return
    setRemoveBusy(true)
    setRemoveError('')
    try {
      const res = await fetch(`/api/cars/${encodeURIComponent(removeTarget.slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete vehicle.')
      }
      invalidateEventsCarsCache()
      toast.success(ar ? `تم حذف "${removeTarget.title}".` : `"${removeTarget.title}" deleted.`, { dedupeKey: `car-delete-${removeTarget.slug}` })
      setRemoveTarget(null)
      // Refresh from the DB source of truth without a full page reload.
      refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete vehicle.'
      setRemoveError(message)
      toast.error(message, { dedupeKey: 'car-delete-error' })
    } finally {
      setRemoveBusy(false)
    }
  }
  const transmissions = [...new Set(liveCars.map((car) => car.transmission))]
  const rows = useMemo(() => liveCars.filter((car) => transmission === 'all' || car.transmission === transmission).filter((car) => `${car.title} ${car.seats}`.toLowerCase().includes(query.trim().toLowerCase())), [liveCars, query, transmission])
  const maxSeats = liveCars.length ? Math.max(...liveCars.map((car) => Number.parseInt(car.seats, 10) || 0)) : 0
  const carSort = useAdminTableSort(rows, {
    vehicle: (row) => row.title,
    capacity: (row) => Number.parseInt(row.seats, 10) || 0,
    transmission: (row) => row.transmission,
    bookings: (row) => bookingsFor(row.slug),
    status: (row) => visibility(row.slug),
  }, 'vehicle', 'asc')
  const paging = usePagination(carSort.sortedRows)

  return <>
    <PageHead eyebrow="Fleet" title="Rent Cars" titleAr="تأجير السيارات" sub="Fleet inventory, capacity, transmission and website visibility" subAr="مخزون الأسطول والسعة وناقل الحركة والظهور على الموقع" actions={<Link className="sp-btn primary" href="/admin/cars/new"><Plus size={17} /> <AdminText en="New vehicle" ar="سيارة جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Fleet vehicles" ar="مركبات الأسطول" />, value: liveCars.length, note: <AdminText en="DB-backed records" ar="سجلات قاعدة البيانات" />, icon: CarFront },
      { label: <AdminText en="Automatic" ar="أوتوماتيك" />, value: liveCars.filter((car) => car.transmission === 'Automatic').length, note: <AdminText en="Automatic transmission" ar="ناقل حركة أوتوماتيك" />, icon: Gauge, tone: 'orange' },
      { label: <AdminText en="Maximum capacity" ar="السعة القصوى" />, value: ar ? `${maxSeats} مقاعد` : `${maxSeats} seats`, note: <AdminText en="Largest group vehicle" ar="أكبر مركبة للمجموعات" />, icon: Armchair, tone: 'green' },
      { label: <AdminText en="Confirmed bookings" ar="الحجوزات المؤكدة" />, value: stats ? stats.totalConfirmedBookings : '…', note: <AdminText en="Confirmed transfer requests" ar="طلبات نقل مؤكدة" />, icon: ShoppingCart, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Fleet" ar="الأسطول" />} sub={<AdminText en={`${rows.length} of ${liveCars.length} vehicles shown`} ar={`عرض ${rows.length} من ${liveCars.length} مركبات`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بمركبة أو سعة...' : 'Search vehicle or capacity...'}>
        <SharedSelect value={transmission} onChange={setTransmission} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب ناقل الحركة' : 'Filter by transmission'} options={[{ value: 'all', label: ar ? 'كل النواقل' : 'All transmissions' }, ...transmissions.map((item) => ({ value: item, label: item }))]} />
      </AdminTableTools>
      {loading ? <AdminEmpty title={<AdminText en="Loading fleet…" ar="جارٍ تحميل الأسطول…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load fleet" ar="تعذر تحميل الأسطول" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Vehicle" ar="المركبة" />} column="vehicle" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Capacity" ar="السعة" />} column="capacity" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Transmission" ar="ناقل الحركة" />} column="transmission" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Bookings" ar="الحجوزات" />} column="bookings" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...carSort} onSort={carSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((car, index) => <tr key={car.slug}><td className="sp-row-number">{paging.from + index}</td><td><span className="sp-cust"><img className="sp-record-thumb" src={car.image} alt="" /><span><strong>{car.title}</strong><small>{car.slug}</small></span></span></td><td>{car.seats}</td><td>{car.transmission}</td><td>{stats ? bookingsFor(car.slug) : '—'}</td><td><StatusPill status={visibility(car.slug)} /></td><td><AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${car.title}` : `Edit ${car.title}`} href={`/admin/cars/new?slug=${car.slug}`} /><AdminIconAction icon={ExternalLink} label={ar ? 'عرض صفحة الأسطول' : 'View fleet page'} href="/rent-car" /><AdminIconAction icon={isHidden(car.slug) ? EyeOff : Eye} label={isHidden(car.slug) ? (ar ? `إظهار ${car.title} على الموقع` : `Show ${car.title} on website`) : (ar ? `إخفاء ${car.title} عن الموقع` : `Hide ${car.title} from website`)} tone={isHidden(car.slug) ? 'success' : undefined} onClick={() => void setPublished(car.slug, isHidden(car.slug) ? true : false)} /><AdminIconAction icon={Trash2} label={ar ? `حذف ${car.title}` : `Delete ${car.title}`} tone="danger" onClick={() => { setRemoveError(''); setRemoveTarget({ slug: car.slug, title: car.title }) }} /></AdminTableActions></td></tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No vehicles found" ar="لا توجد مركبات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <AdminConfirmDialog
      open={removeTarget !== null}
      onClose={() => { if (!removeBusy) setRemoveTarget(null) }}
      onConfirm={() => { void removeCar() }}
      title={<AdminText en="Delete this vehicle?" ar="حذف هذه المركبة؟" />}
      description={<AdminText en="This permanently removes the vehicle from the admin fleet and the public rent-car page." ar="يزيل هذه المركبة نهائيًا من أسطول الإدارة ومن صفحة تأجير السيارات العامة." />}
      confirmLabel={<AdminText en={removeBusy ? 'Deleting…' : 'Delete vehicle'} ar={removeBusy ? 'جارٍ الحذف…' : 'حذف المركبة'} />}
      cancelLabel={<AdminText en="Keep" ar="إبقاء" />}
      tone="danger"
      canConfirm={!removeBusy}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{removeTarget?.title}</p>
        {removeError ? <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{removeError}</p> : null}
      </div>
    </AdminConfirmDialog>
  </>
}
