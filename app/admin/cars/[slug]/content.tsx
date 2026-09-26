'use client'

import Link from 'next/link'
import { ArrowLeft, CarFront, Eye, EyeOff, Pencil } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { isCustomSlug, setCarHidden, useCarOverride, useHiddenCars, useLiveCollection } from '@/lib/admin-store'
import { cars } from '@/data/content'
import { getEffectiveRequests, useCarRequestOps } from '@/lib/car-request-ops'

/**
 * Fleet vehicle detail. Only honest/computable data: overview, source
 * (base fleet / locally overridden / admin-created), website visibility
 * (never called availability), and related DEMO requests matched by
 * requested or assigned vehicle slug. No availability, rentals, revenue,
 * maintenance, or ratings — those belong to the backend phase.
 */
export function VehicleDetailContent({ vehicleSlug }: { vehicleSlug: string }) {
  const ar = useAdminLocale() === 'ar'
  const slug = decodeURIComponent(vehicleSlug)
  // includeHidden: admin inspects hidden vehicles here too.
  const liveCars = useLiveCollection('cars', cars, { includeHidden: true })
  const car = liveCars.find((entry) => entry.slug === slug)
  const override = useCarOverride(slug)
  const hiddenCars = useHiddenCars()
  const opsStore = useCarRequestOps()

  if (!car) {
    return <>
      <PageHead eyebrow="Fleet" title="Vehicle" titleAr="السيارة" actions={<Link className="sp-btn" href="/admin/cars"><ArrowLeft size={16} /> <AdminText en="Back to fleet" ar="رجوع للأسطول" /></Link>} />
      <AdminEmpty title={<AdminText en="Vehicle not found" ar="السيارة غير موجودة" />} copy={<AdminText en="This vehicle slug does not exist in the fleet." ar="معرف السيارة هذا غير موجود في الأسطول." />} />
    </>
  }

  const hidden = hiddenCars.includes(car.slug)
  const custom = isCustomSlug(car.slug)
  const source = custom
    ? { en: 'Admin-created', ar: 'أُنشئت من الإدارة' }
    : override
      ? { en: 'Locally overridden', ar: 'معدّلة محليًا' }
      : { en: 'Base fleet', ar: 'الأسطول الأساسي' }

  const related = getEffectiveRequests(opsStore).filter(
    (row) => row.vehicleSlug === car.slug || (row.assignmentTouched && row.assignedVehicleSlug === car.slug),
  )

  return <>
    <PageHead
      eyebrow="Fleet"
      title={car.title}
      titleAr={car.title}
      sub={car.slug}
      actions={<>
        <Link className="sp-btn" href="/admin/cars"><ArrowLeft size={16} /> <AdminText en="Back to fleet" ar="رجوع للأسطول" /></Link>
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
          <div><small><AdminText en="Capacity" ar="السعة" /></small><strong>{car.seats || '—'}</strong></div>
          <div><small><AdminText en="Transmission" ar="ناقل الحركة" /></small><strong>{car.transmission || '—'}</strong></div>
          <div><small><AdminText en="Daily rate" ar="السعر اليومي" /></small><strong>${car.dailyPrice}</strong></div>
          <div><small><AdminText en="Source" ar="المصدر" /></small><strong>{ar ? source.ar : source.en}</strong></div>
        </div>
        <div>
          <span className={hidden ? 'sp-pill is-hidden' : 'sp-pill is-active'}>
            {hidden
              ? <AdminText en="Hidden from website" ar="مخفي من الموقع" />
              : <AdminText en="Visible on website" ar="ظاهر على الموقع" />}
          </span>
        </div>
      </Card>

      <Card title={<AdminText en="Website visibility" ar="الظهور على الموقع" />} sub={<AdminText en="Local prototype control — not availability" ar="تحكم تجريبي محلي — ليس التوافر" />}>
        <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.7 }}>
          <AdminText
            en="Controls whether this vehicle appears on the public fleet and request forms on this browser only. Hidden vehicles stay fully visible inside admin."
            ar="يتحكم في ظهور هذه السيارة في الأسطول العام ونماذج الطلب على هذا المتصفح فقط. تبقى السيارات المخفية ظاهرة بالكامل داخل الإدارة."
          />
        </p>
        <button
          type="button"
          className={hidden ? 'sp-btn primary' : 'sp-btn'}
          onClick={() => setCarHidden(car.slug, !hidden)}
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          {hidden
            ? <AdminText en="Show on website" ar="إظهار على الموقع" />
            : <AdminText en="Hide from website" ar="إخفاء عن الموقع" />}
        </button>
      </Card>
    </div>

    <Card
      title={<AdminText en="Related car requests" ar="طلبات السيارات المرتبطة" />}
      sub={<AdminText en={`${related.length} demo requests · matched by requested or assigned vehicle`} ar={`${related.length} طلبات تجريبية · مطابقة بالمركبة المطلوبة أو المخصصة`} />}
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
              const assigned = row.assignmentTouched && row.assignedVehicleSlug === car.slug
              return (
                <tr key={row.ref}>
                  <td><Link href={`/admin/car-requests/${row.ref}`} style={{ fontWeight: 700 }} dir="ltr">{row.ref}</Link></td>
                  <td>{row.customerName}</td>
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
                  <td><Link className="sp-btn" href={`/admin/car-requests/${row.ref}`}><AdminText en="Open" ar="فتح" /></Link></td>
                </tr>
              )
            })}
          </tbody>
        </table></AdminTableWrap>
      ) : (
        <AdminEmpty title={<AdminText en="No demo requests for this vehicle" ar="لا توجد طلبات تجريبية لهذه السيارة" />} />
      )}
    </Card>
  </>
}
