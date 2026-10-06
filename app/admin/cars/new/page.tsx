'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminText } from '@/components/admin/admin-ui'
import { VehicleForm } from '@/components/admin/vehicle-form'
import { isCustomSlug, removeCarOverride, saveCarOverride, saveCustomItem, useCarOverride, useLiveCollection } from '@/lib/admin-store'
import { cars } from '@/data/content'
import type { Car } from '@/data/types'

function NewCarInner() {
  const router = useRouter()
  const params = useSearchParams()
  const slug = params.get('slug')
  // Include hidden vehicles so a hidden car can still be found and edited.
  const liveCars = useLiveCollection('cars', cars, { includeHidden: true })
  const editing = slug ? liveCars.find((car) => car.slug === slug) : undefined

  const save = (car: Car) => {
    // Canonical rows persist a local override; data/content.ts is never mutated.
    if (isCustomSlug(car.slug)) saveCustomItem('cars', car)
    else saveCarOverride(car)
    router.push('/admin/cars')
  }

  if (slug && !editing) {
    return <>
      <PageHead eyebrow="Fleet" title="Edit vehicle" titleAr="تعديل سيارة" backHref="/admin/cars" />
      <AdminEmpty title={<AdminText en="Vehicle not found" ar="السيارة غير موجودة" />} />
    </>
  }

  const isCanonicalEdit = !!editing && !isCustomSlug(editing.slug)
  // Reset is offered only while a local override actually exists.
  const hasOverride = isCanonicalEdit && useCarOverride(editing?.slug ?? '') !== undefined

  return <>
    <PageHead
      eyebrow="Fleet"
      title={editing ? 'Edit vehicle' : 'New vehicle'}
      titleAr={editing ? 'تعديل سيارة' : 'سيارة جديدة'}
      sub={editing ? (isCanonicalEdit ? 'Local override — canonical data stays untouched' : undefined) : 'Published to the fleet and request forms'}
      subAr={editing ? (isCanonicalEdit ? 'تجاوز محلي — البيانات الأصلية لا تتغير' : undefined) : 'تنشر في الأسطول ونماذج الطلب'}
      backHref="/admin/cars"
      actions={hasOverride ? (
          <button type="button" className="sp-delete-btn" onClick={() => { if (editing) { removeCarOverride(editing.slug); router.push('/admin/cars') } }}>
            <AdminText en="Reset to default" ar="إعادة للافتراضي" />
          </button>
        ) : undefined}
    />
    {editing
      ? <VehicleForm key={editing.slug} initial={editing} submitLabel={<AdminText en="Save changes" ar="حفظ التغييرات" />} onSubmit={save} />
      : <VehicleForm submitLabel={<AdminText en="Add vehicle" ar="إضافة السيارة" />} onSubmit={save} />}
  </>
}

export default function NewCarPage() {
  return (
    <Suspense>
      <NewCarInner />
    </Suspense>
  )
}
