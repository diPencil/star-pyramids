'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Armchair, CarFront, CircleDollarSign, ExternalLink, Eye, EyeOff, Gauge, Pencil, Plus } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { cars } from '@/data/content'
import { invalidateEventsCarsCache, useDbCars } from '@/lib/events-cars-client'

export default function CarsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [transmission, setTransmission] = useState('all')
  const [actionError, setActionError] = useState('')
  // DB-authoritative fleet: admin sees hidden vehicles too; visibility
  // travels in the record (`isPublished`), never in browser storage.
  const liveCars = useDbCars(cars)
  const isHidden = (slug: string) => liveCars.find((car) => car.slug === slug)?.isPublished === false
  const visibility = (slug: string) => (isHidden(slug) ? 'hidden' : 'active')
  const setPublished = async (slug: string, published: boolean) => {
    setActionError('')
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
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update visibility.')
    }
  }
  const removeCar = async (slug: string) => {
    setActionError('')
    try {
      const res = await fetch(`/api/cars/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete vehicle.')
      }
      invalidateEventsCarsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete vehicle.')
    }
  }
  const transmissions = [...new Set(liveCars.map((car) => car.transmission))]
  const rows = useMemo(() => liveCars.filter((car) => transmission === 'all' || car.transmission === transmission).filter((car) => `${car.title} ${car.seats}`.toLowerCase().includes(query.trim().toLowerCase())), [liveCars, query, transmission])
  const averageRate = liveCars.length ? Math.round(liveCars.reduce((sum, car) => sum + car.dailyPrice, 0) / liveCars.length) : 0
  const maxSeats = Math.max(...liveCars.map((car) => Number.parseInt(car.seats, 10) || 0))
  const carSort = useAdminTableSort(rows, {
    vehicle: (row) => row.title,
    capacity: (row) => Number.parseInt(row.seats, 10) || 0,
    transmission: (row) => row.transmission,
    rate: (row) => row.dailyPrice,
    status: (row) => visibility(row.slug),
  }, 'vehicle', 'asc')
  const paging = usePagination(carSort.sortedRows)

  return <>
    <PageHead eyebrow="Fleet" title="Rent Cars" titleAr="تأجير السيارات" sub="Fleet inventory, capacity, rates and website visibility" subAr="مخزون الأسطول والسعة والأسعار والظهور على الموقع" actions={<Link className="sp-btn primary" href="/admin/cars/new"><Plus size={17} /> <AdminText en="New vehicle" ar="سيارة جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Fleet vehicles" ar="مركبات الأسطول" />, value: liveCars.length, note: <AdminText en="DB-backed records" ar="سجلات قاعدة البيانات" />, icon: CarFront },
      { label: <AdminText en="Automatic" ar="أوتوماتيك" />, value: liveCars.filter((car) => car.transmission === 'Automatic').length, note: <AdminText en="Automatic transmission" ar="ناقل حركة أوتوماتيك" />, icon: Gauge, tone: 'orange' },
      { label: <AdminText en="Maximum capacity" ar="السعة القصوى" />, value: ar ? `${maxSeats} مقاعد` : `${maxSeats} seats`, note: <AdminText en="Largest group vehicle" ar="أكبر مركبة للمجموعات" />, icon: Armchair, tone: 'green' },
      { label: <AdminText en="Average daily rate" ar="متوسط السعر اليومي" />, value: `$${averageRate}`, note: <AdminText en="Across the current fleet" ar="عبر الأسطول الحالي" />, icon: CircleDollarSign, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Fleet" ar="الأسطول" />} sub={<AdminText en={`${rows.length} of ${liveCars.length} vehicles shown`} ar={`عرض ${rows.length} من ${liveCars.length} مركبات`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بمركبة أو سعة...' : 'Search vehicle or capacity...'}>
        <SharedSelect value={transmission} onChange={setTransmission} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب ناقل الحركة' : 'Filter by transmission'} options={[{ value: 'all', label: ar ? 'كل النواقل' : 'All transmissions' }, ...transmissions.map((item) => ({ value: item, label: item }))]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Vehicle" ar="المركبة" />} column="vehicle" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Capacity" ar="السعة" />} column="capacity" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Transmission" ar="ناقل الحركة" />} column="transmission" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Daily rate" ar="السعر اليومي" />} column="rate" {...carSort} onSort={carSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...carSort} onSort={carSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((car, index) => <tr key={car.slug}><td className="sp-row-number">{paging.from + index}</td><td><span className="sp-cust"><img className="sp-record-thumb" src={car.image} alt="" /><span><strong>{car.title}</strong><small>{car.slug}</small></span></span></td><td>{car.seats}</td><td>{car.transmission}</td><td>${car.dailyPrice}</td><td><StatusPill status={visibility(car.slug)} /></td><td><AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${car.title}` : `Edit ${car.title}`} href={`/admin/cars/new?slug=${car.slug}`} /><AdminIconAction icon={ExternalLink} label={ar ? 'عرض صفحة الأسطول' : 'View fleet page'} href="/rent-car" /><AdminIconAction icon={isHidden(car.slug) ? EyeOff : Eye} label={isHidden(car.slug) ? (ar ? `إظهار ${car.title} على الموقع` : `Show ${car.title} on website`) : (ar ? `إخفاء ${car.title} عن الموقع` : `Hide ${car.title} from website`)} tone={isHidden(car.slug) ? 'success' : undefined} onClick={() => void setPublished(car.slug, isHidden(car.slug) ? true : false)} /><button type="button" className="sp-delete-btn" onClick={() => void removeCar(car.slug)}><AdminText en="Delete" ar="حذف" /></button></AdminTableActions></td></tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No vehicles found" ar="لا توجد مركبات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
