'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CarFront, Eye, EyeOff, Pencil } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminTableActions, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { invalidateEventsCarsCache, useDbCarsStatus } from '@/lib/events-cars-client'
import type { StaffCarRequest } from '@/lib/car-request'

/**
 * Fleet vehicle detail. Only honest/computable data: overview, website
 * visibility (never called availability), and related database-backed
 * requests matched by requested or assigned vehicle slug. No availability,
 * rentals, revenue, maintenance, or ratings — those belong to a later
 * backend phase.
 */
export function VehicleDetailContent({ vehicleSlug }: { vehicleSlug: string }) {
  const ar = useAdminLocale() === 'ar'
  const slug = decodeURIComponent(vehicleSlug)
  // DB-authoritative fleet with no static fallback; a failed API read
  // renders loading/error here, never bootstrap rows as fleet records.
  const { data, loading, error, retry } = useDbCarsStatus()
  const liveCars = data ?? []
  const car = liveCars.find((entry) => entry.slug === slug)
  const [staffRequests, setStaffRequests] = useState<StaffCarRequest[]>([])
  const [visibilityError, setVisibilityError] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/car-requests', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { requests?: StaffCarRequest[] }
        if (!cancelled && Array.isArray(data.requests)) setStaffRequests(data.requests)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  if (loading || error || !car) {
    return <>
      <PageHead eyebrow="Fleet" title="Vehicle" titleAr="السيارة" backHref="/admin/cars" />
      {loading ? <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading vehicle…" ar="جارٍ تحميل السيارة…" /></p></Card>
      : error ? <Card title={<AdminText en="Could not load vehicle" ar="تعذر تحميل السيارة" />}><p>{error}</p><div style={{ display: 'flex', gap: 10, marginTop: 14 }}><button type="button" className="sp-btn primary" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></Card>
      : <AdminEmpty title={<AdminText en="Vehicle not found" ar="السيارة غير موجودة" />} copy={<AdminText en="This vehicle slug does not exist in the fleet." ar="معرف السيارة هذا غير موجود في الأسطول." />} />}
    </>
  }

  const hidden = car?.isPublished === false

  const setPublished = async (published: boolean) => {
    if (!car) return
    setVisibilityError('')
    try {
      const res = await fetch(`/api/cars/${encodeURIComponent(car.slug)}`, {
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
      setVisibilityError(err instanceof Error ? err.message : 'Failed to update visibility.')
    }
  }

  const related = staffRequests.filter(
    (row) => row.vehicleSlug === car.slug || (row.assignedVehicleSlug !== '' && row.assignedVehicleSlug === car.slug),
  )

  return <>
    <PageHead
      eyebrow="Fleet"
      title={car.title}
      titleAr={car.title}
      sub={car.slug}
      backHref="/admin/cars"
      actions={<>
        <Link className="sp-btn" href={`/admin/cars/new?slug=${car.slug}`}><Pencil size={16} /> <AdminText en="Edit vehicle" ar="تعديل السيارة" /></Link>
        <Link className="sp-btn" href="/rent-car"><CarFront size={16} /> <AdminText en="Rent-car page" ar="صفحة التأجير" /></Link>
      </>}
    />

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Vehicle overview" ar="نظرة عامة على السيارة" />}>
        {car.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={car.image} alt={car.title} loading="lazy" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, background: '#eef1f7', marginBottom: 14 }} />
        ) : (
          <p style={{ color: 'var(--sp-muted)', fontSize: 13 }}><AdminText en="No image set for this vehicle." ar="لا توجد صورة لهذه السيارة." /></p>
        )}
        <div className="sp-detail-grid">
          <div><small><AdminText en="Title" ar="الاسم" /></small><strong>{car.title}</strong></div>
          <div><small><AdminText en="Slug" ar="المعرف" /></small><strong>{car.slug}</strong></div>
          <div><small><AdminText en="Capacity" ar="السعة" /></small><strong>{car.seats || '-'}</strong></div>
          <div><small><AdminText en="Transmission" ar="ناقل الحركة" /></small><strong>{car.transmission || '-'}</strong></div>
          <div><small><AdminText en="Daily rate" ar="السعر اليومي" /></small><strong>${car.dailyPrice}</strong></div>
        </div>
        <div>
          <span className={hidden ? 'sp-pill is-hidden' : 'sp-pill is-active'}>
            {hidden
              ? <AdminText en="Hidden from website" ar="مخفي من الموقع" />
              : <AdminText en="Visible on website" ar="ظاهر على الموقع" />}
          </span>
        </div>
      </Card>

      <Card title={<AdminText en="Website visibility" ar="الظهور على الموقع" />} sub={<AdminText en="Database control - not availability" ar="تحكم من قاعدة البيانات - ليس التوافر" />}>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.7 }}>
          <AdminText
            en="Controls whether this vehicle appears on the public fleet and request forms everywhere. Hidden vehicles stay fully visible inside admin."
            ar="يتحكم في ظهور هذه السيارة في الأسطول العام ونماذج الطلب في كل مكان. تبقى السيارات المخفية ظاهرة بالكامل داخل الإدارة."
          />
        </p>
        <button
          type="button"
          className={hidden ? 'sp-btn primary' : 'sp-btn'}
          onClick={() => void setPublished(!hidden)}
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          {hidden
            ? <AdminText en="Show on website" ar="إظهار على الموقع" />
            : <AdminText en="Hide from website" ar="إخفاء عن الموقع" />}
        </button>
        {visibilityError && <p role="alert" style={{ color: '#b91c1c', marginTop: 8 }}>{visibilityError}</p>}
      </Card>
    </div>

    <Card
      title={<AdminText en="Related car requests" ar="طلبات السيارات المرتبطة" />}
      sub={<AdminText en={`${related.length} stored requests · matched by requested or assigned vehicle`} ar={`${related.length} طلبات محفوظة · مطابقة بالمركبة المطلوبة أو المخصصة`} />}
    >
      {related.length ? (
        <AdminTableWrap><table className="sp-table">
          <thead><tr>
            <th><AdminText en="Request" ar="الطلب" /></th>
            <th><AdminText en="Customer" ar="العميل" /></th>
            <th><AdminText en="Trip" ar="الرحلة" /></th>
            <th><AdminText en="Preferred date" ar="التاريخ المفضل" /></th>
            <th><AdminText en="Passengers" ar="الركاب" /></th>
            <th><AdminText en="Status" ar="الحالة" /></th>
            <th><AdminText en="Relation" ar="العلاقة" /></th>
            <th></th>
          </tr></thead>
          <tbody>
            {related.map((row) => {
              const requested = row.vehicleSlug === car.slug
              const assigned = row.assignedVehicleSlug !== '' && row.assignedVehicleSlug === car.slug
              return (
                <tr key={row.reference}>
                  <td><Link href={`/admin/car-requests/${row.reference}`} style={{ fontWeight: 700 }} dir="ltr">{row.reference}</Link></td>
                  <td>{row.contact.name}</td>
                  <td>{row.tripType}</td>
                  <td dir="ltr">{row.preferredPickupDate}</td>
                  <td>{row.passengers}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      {requested && <span className="sp-pill is-draft"><AdminText en="Requested" ar="مطلوبة" /></span>}
                      {assigned && <span className="sp-pill is-reviewing"><AdminText en="Assigned" ar="مخصصة" /></span>}
                    </span>
                  </td>
                  <td><AdminTableActions><AdminIconAction icon={Eye} label={ar ? `فتح الطلب ${row.reference}` : `Open request ${row.reference}`} href={`/admin/car-requests/${row.reference}`} /></AdminTableActions></td>
                </tr>
              )
            })}
          </tbody>
        </table></AdminTableWrap>
      ) : (
        <AdminEmpty title={<AdminText en="No stored requests for this vehicle" ar="لا توجد طلبات محفوظة لهذه السيارة" />} />
      )}
    </Card>
  </>
}
