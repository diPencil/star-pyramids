'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { GalleryForm } from '@/components/admin/gallery-form'
import type { GalleryItem } from '@/lib/journey-gallery'

function isGalleryItem(row: unknown): row is GalleryItem {
  if (!row || typeof row !== 'object') return false
  const item = row as GalleryItem
  return (
    typeof item.id === 'string' &&
    (item.mediaType === 'IMAGE' || item.mediaType === 'VIDEO') &&
    typeof item.mediaUrl === 'string' &&
    typeof item.title === 'string'
  )
}

function GalleryFormLoader() {
  const params = useSearchParams()
  const editId = params.get('id') ?? ''
  const [remote, setRemote] = useState<GalleryItem | null | undefined>(editId ? undefined : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!editId) {
      setRemote(null)
      return
    }
    let cancelled = false
    setRemote(undefined)
    setLoadError(null)
    // Single source of truth: the DB record.
    fetch(`/api/journey-gallery/${encodeURIComponent(editId)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          if (res.status === 404 || res.status === 401 || res.status === 403) setRemote(null)
          else setLoadError(`Request failed (${res.status}).`)
          return
        }
        const data = (await res.json()) as { item?: unknown }
        if (!cancelled) setRemote(isGalleryItem(data.item) ? data.item : null)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not reach the database.')
      })
    return () => { cancelled = true }
  }, [editId, attempt])

  if (editId && remote === undefined && loadError) {
    return <>
      <PageHead eyebrow="Content" title="Edit gallery item" titleAr="تعديل عنصر" backHref="/admin/gallery" />
      <Card title={<AdminText en="Could not load item" ar="تعذر تحميل العنصر" />}>
        <p>{loadError}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="sp-btn primary" onClick={() => { setLoadError(null); setRemote(undefined); setAttempt((n) => n + 1) }}><AdminText en="Retry" ar="إعادة المحاولة" /></button>
        </div>
      </Card>
    </>
  }
  if (editId && remote === undefined) {
    return <>
      <PageHead eyebrow="Content" title="Edit gallery item" titleAr="تعديل عنصر" backHref="/admin/gallery" />
      <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading gallery item…" ar="جارٍ تحميل العنصر…" /></p></Card>
    </>
  }
  if (editId && remote === null) {
    return <>
      <PageHead eyebrow="Content" title="Item not found" titleAr="العنصر غير موجود" backHref="/admin/gallery" />
      <Card title={<AdminText en="Item not found" ar="العنصر غير موجود" />}>
        <p><AdminText en={`No gallery item matches "${editId}".`} ar={`لا يوجد عنصر بالمعرف "${editId}".`} /></p>
      </Card>
    </>
  }
  return <GalleryForm key={editId || 'new'} initial={remote ?? null} editId={editId} />
}

export default function NewGalleryItemPage() {
  return <Suspense><GalleryFormLoader /></Suspense>
}
