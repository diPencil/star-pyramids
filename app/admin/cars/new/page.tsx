'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminText, Card } from '@/components/admin/admin-ui'
import { VehicleForm } from '@/components/admin/vehicle-form'
import { invalidateEventsCarsCache } from '@/lib/events-cars-client'
import type { Car } from '@/data/types'

function NewCarInner() {
  const router = useRouter()
  const params = useSearchParams()
  const slug = params.get('slug')
  // Single source of truth: the DB record. Base snapshots would leave
  // admin-created slugs unresolvable and risk stale form state.
  const [record, setRecord] = useState<Car | null | undefined>(slug ? undefined : null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!slug) {
      setRecord(null)
      return
    }
    let cancelled = false
    setRecord(undefined)
    setLoadError('')
    fetch(`/api/cars/${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setRecord(null)
          return
        }
        const data = (await res.json()) as { car?: Car }
        if (!cancelled) setRecord(data.car ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setRecord(null)
          setLoadError('Could not load vehicle.')
        }
      })
    return () => { cancelled = true }
  }, [slug])

  const save = async (car: Car) => {
    setSaveError('')
    try {
      const url = slug ? `/api/cars/${encodeURIComponent(slug)}` : '/api/cars'
      const res = await fetch(url, {
        method: slug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(car),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save vehicle.')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save vehicle.')
      return
    }
    invalidateEventsCarsCache()
    router.push('/admin/cars')
  }

  if (record === undefined) {
    return <>
      <PageHead eyebrow="Fleet" title={slug ? 'Edit vehicle' : 'New vehicle'} titleAr={slug ? 'تعديل سيارة' : 'سيارة جديدة'} backHref="/admin/cars" />
      <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading vehicle…" ar="جارٍ تحميل السيارة…" /></p></Card>
    </>
  }

  if (slug && !record) {
    return <>
      <PageHead eyebrow="Fleet" title="Edit vehicle" titleAr="تعديل سيارة" backHref="/admin/cars" />
      <AdminEmpty title={<AdminText en="Vehicle not found" ar="السيارة غير موجودة" />} copy={loadError ? <AdminText en={loadError} ar="تعذر تحميل السيارة." /> : undefined} />
    </>
  }

  return <>
    <PageHead
      eyebrow="Fleet"
      title={record ? 'Edit vehicle' : 'New vehicle'}
      titleAr={record ? 'تعديل سيارة' : 'سيارة جديدة'}
      sub={record ? undefined : 'Published to the fleet and request forms'}
      subAr={record ? undefined : 'تنشر في الأسطول ونماذج الطلب'}
      backHref="/admin/cars"
    />
    {record
      ? <VehicleForm key={record.slug} initial={record} submitLabel={<AdminText en="Save changes" ar="حفظ التغييرات" />} onSubmit={save} />
      : <VehicleForm submitLabel={<AdminText en="Add vehicle" ar="إضافة السيارة" />} onSubmit={save} />}
    {saveError && <p role="alert" style={{ color: '#b91c1c' }}>{saveError}</p>}
  </>
}

export default function NewCarPage() {
  return (
    <Suspense>
      <NewCarInner />
    </Suspense>
  )
}
