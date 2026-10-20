'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Film, Images, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { invalidateJourneyGalleryCache } from '@/lib/journey-gallery-client'
import { toast } from '@/components/admin/admin-toaster'
import {
  galleryPlatformLabel,
  type GalleryItem,
} from '@/lib/journey-gallery'

function payloadOf(item: GalleryItem) {
  return {
    mediaType: item.mediaType,
    mediaUrl: item.mediaUrl,
    platform: item.platform,
    title: item.title,
    titleAr: item.titleAr ?? '',
    caption: item.caption ?? '',
    thumbnail: item.thumbnail ?? '',
    showOnHomepage: item.showOnHomepage,
    showOnTours: item.showOnTours,
    tourScope: item.tourScope,
    tourSlugs: item.tourSlugs,
    isPublished: item.isPublished,
    sortOrder: item.sortOrder,
  }
}

/** Compact second line for the title cell: caption, platform, or file name — never a raw long URL. */
function itemSubtitle(item: GalleryItem): string {
  if (item.caption?.trim()) return item.caption.trim().slice(0, 80)
  if (item.mediaType === 'VIDEO' && item.platform) return galleryPlatformLabel(item.platform)
  const tail = item.mediaUrl.split(/[?#]/)[0].split('/').pop() ?? ''
  if (tail) return tail.length > 34 ? `…${tail.slice(-33)}` : tail
  return item.mediaType === 'IMAGE' ? 'Photo' : 'Video'
}

export default function JourneyGalleryPage() {
  const ar = useAdminLocale() === 'ar'
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [migrationPending, setMigrationPending] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all')
  const [target, setTarget] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState('')

  const load = async () => {
    setLoadError('')
    setMigrationPending(false)
    try {
      const res = await fetch('/api/journey-gallery?admin=1', { credentials: 'same-origin' })
      const data = (await res.json().catch(() => null)) as { items?: unknown; error?: unknown } | null
      if (res.status === 401 || res.status === 403) throw new Error(ar ? 'غير مصرح لك بإدارة المعرض.' : 'You are not allowed to manage the gallery.')
      if (res.status === 503) { setMigrationPending(true); setItems([]); return }
      if (!res.ok || !Array.isArray(data?.items)) throw new Error(typeof data?.error === 'string' ? data.error : (ar ? 'تعذر تحميل المعرض.' : 'Could not load the gallery.'))
      setItems(data.items as GalleryItem[])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the gallery.')
    }
  }

  useEffect(() => { void load() }, [])

  const refresh = async () => { invalidateJourneyGalleryCache(); await load() }

  const mutate = async (fn: () => Promise<void>, busyKey: string) => {
    setActionBusy(busyKey)
    try { await fn(); await refresh() }
    catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.', { dedupeKey: `${busyKey}-error` })
    }
    finally { setActionBusy('') }
  }

  const setPublished = (item: GalleryItem, published: boolean) =>
    mutate(async () => {
      const res = await fetch(`/api/journey-gallery/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...payloadOf(item), isPublished: published }),
      })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update visibility.')
      toast.success(
        published
          ? (ar ? `تم نشر "${item.title}". ظهر على الموقع العام.` : `"${item.title}" published. It now appears on the public website.`)
          : (ar ? `تم إخفاء "${item.title}" عن الموقع العام.` : `"${item.title}" hidden from the public website.`),
        { dedupeKey: `gallery-publish-${item.id}` },
      )
    }, `publish-${item.id}`)

  const removeItem = (id: string) =>
    mutate(async () => {
      const res = await fetch(`/api/journey-gallery/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete item.')
      toast.success(ar ? 'تم حذف عنصر المعرض.' : 'Gallery item deleted.', { dedupeKey: `gallery-delete-${id}` })
    }, `delete-${id}`)

  const liveItems = items ?? []
  // Canonical display order shared by the storefronts.
  const orderedAll = useMemo(() => [...liveItems].sort((a, b) => a.sortOrder - b.sortOrder), [liveItems])

  const rows = useMemo(() => liveItems
    .filter((item) => typeFilter === 'all' || (typeFilter === 'photo' ? item.mediaType === 'IMAGE' : item.mediaType === 'VIDEO'))
    .filter((item) => visibility === 'all' || (visibility === 'hidden' ? !item.isPublished : item.isPublished))
    .filter((item) => target === 'all' || (target === 'homepage' ? item.showOnHomepage : item.showOnTours))
    .filter((item) => `${item.title} ${item.caption ?? ''} ${item.mediaUrl}`.toLowerCase().includes(query.trim().toLowerCase())), [liveItems, query, typeFilter, visibility, target])

  const tableSort = useAdminTableSort(rows, {
    title: (row) => row.title,
    type: (row) => row.mediaType,
    order: (row) => row.sortOrder,
    status: (row) => (row.isPublished ? 'published' : 'hidden'),
  }, 'order', 'asc')
  const paging = usePagination(tableSort.sortedRows)

  // Reorder arrows only make sense on the unfiltered, order-sorted list:
  // otherwise a hidden row could move with no visible feedback.
  const reorderReady = !query.trim() && typeFilter === 'all' && visibility === 'all' && target === 'all'
    && tableSort.sortKey === 'order' && tableSort.direction === 'asc' && actionBusy === ''
  const reorderHint = ar
    ? 'أعد ضبط البحث والفلاتر والترتيب الافتراضي لتفعيل التحريك'
    : 'Clear search, filters, and custom sorting to reorder'

  const moveItem = (id: string, direction: -1 | 1) =>
    mutate(async () => {
      const index = orderedAll.findIndex((item) => item.id === id)
      const swapWith = index + direction
      if (index < 0 || swapWith < 0 || swapWith >= orderedAll.length) return
      const next = [...orderedAll]
      const [moved] = next.splice(index, 1)
      next.splice(swapWith, 0, moved)
      const order = next.map((item, position) => ({ id: item.id, sortOrder: (position + 1) * 10 }))
      const res = await fetch('/api/journey-gallery/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ order }),
      })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to reorder.')
    }, `move-${id}`)

  const photoCount = liveItems.filter((i) => i.mediaType === 'IMAGE').length
  const videoCount = liveItems.filter((i) => i.mediaType === 'VIDEO').length
  const publishedCount = liveItems.filter((i) => i.isPublished).length
  const hiddenCount = liveItems.length - publishedCount

  return <>
    <PageHead eyebrow="Content" title="Journey Gallery" titleAr="معرض الرحلات" sub="Homepage rows and tour video reels, managed in one place" subAr="صفوف الرئيسية وفيديوهات الرحلات من مكان واحد" actions={<Link className="sp-btn primary" href="/admin/gallery/new"><Plus size={17} /> <AdminText en="New item" ar="عنصر جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Photos" ar="الصور" />, value: liveItems.length ? photoCount : '0', note: <AdminText en="Homepage photo row" ar="صف صور الرئيسية" />, icon: Images },
      { label: <AdminText en="Videos" ar="الفيديوهات" />, value: liveItems.length ? videoCount : '0', note: <AdminText en="Homepage + tour pages" ar="الرئيسية + صفحات الرحلات" />, icon: Film, tone: 'orange' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: liveItems.length ? publishedCount : '0', note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: Eye, tone: 'violet' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: liveItems.length ? hiddenCount : '0', note: <AdminText en="Admin only" ar="للإدارة فقط" />, icon: EyeOff, tone: 'orange' },
    ]} />
    {migrationPending ? <Card title={<AdminText en="Database tables pending" ar="جداول قاعدة البيانات معلقة" />} sub={<AdminText en="The additive journey-gallery migration has not been applied yet." ar="لم يتم تطبيق ترحيل معرض الرحلات بعد." />}>
      <AdminEmpty title={<AdminText en="Gallery management is unavailable" ar="إدارة المعرض غير متاحة" />} copy={<AdminText en="Apply prisma/migrations/20261013000000_journey_gallery/migration.sql with explicit authorization. The website keeps showing its existing gallery content meanwhile." ar="طبّق الترحيل بتصريح صريح. ويستمر الموقع في عرض محتوى المعرض الحالي." />} />
    </Card> : <Card title={<AdminText en="All gallery items" ar="كل عناصر المعرض" />} sub={<AdminText en={`${rows.length} of ${liveItems.length} shown`} ar={`عرض ${rows.length} من ${liveItems.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في المعرض...' : 'Search the gallery...'}>
        <SharedSelect value={typeFilter} onChange={setTypeFilter} locale={ar ? 'ar' : 'en'} label={ar ? 'النوع' : 'Type'} options={[{ value: 'all', label: ar ? 'كل الأنواع' : 'All types' }, { value: 'photo', label: ar ? 'صور' : 'Photos' }, { value: 'video', label: ar ? 'فيديوهات' : 'Videos' }]} />
        <SharedSelect value={visibility} onChange={(next) => setVisibility(next as typeof visibility)} locale={ar ? 'ar' : 'en'} label={ar ? 'الظهور' : 'Visibility'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'published', label: ar ? 'المنشورة' : 'Published' }, { value: 'hidden', label: ar ? 'المخفية' : 'Hidden' }]} />
        <SharedSelect value={target} onChange={setTarget} locale={ar ? 'ar' : 'en'} label={ar ? 'مكان العرض' : 'Placement'} options={[{ value: 'all', label: ar ? 'كل الأماكن' : 'All placements' }, { value: 'homepage', label: ar ? 'الرئيسية' : 'Homepage' }, { value: 'tours', label: ar ? 'صفحات الرحلات' : 'Tour pages' }]} />
      </AdminTableTools>
      {items === null && !loadError ? <AdminEmpty title={<AdminText en="Loading gallery…" ar="جارٍ تحميل المعرض…" />} copy={<AdminText en="Reading the authoritative gallery." ar="تتم قراءة المعرض المعتمد." />} />
      : loadError ? <><AdminEmpty title={<AdminText en="Could not load the gallery" ar="تعذر تحميل المعرض" />} copy={<AdminText en={loadError} ar={loadError} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={() => void load()}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><th><AdminText en="Preview" ar="معاينة" /></th><SortableTh label={<AdminText en="Title" ar="العنوان" />} column="title" {...tableSort} onSort={tableSort.sortBy} /><SortableTh label={<AdminText en="Type" ar="النوع" />} column="type" {...tableSort} onSort={tableSort.sortBy} /><th><AdminText en="Placement" ar="مكان العرض" /></th><SortableTh label={<AdminText en="Order" ar="الترتيب" />} column="order" {...tableSort} onSort={tableSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...tableSort} onSort={tableSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((item, index) => {
          const hidden = !item.isPublished
          const position = orderedAll.findIndex((row) => row.id === item.id)
          const canMoveUp = reorderReady && position > 0
          const canMoveDown = reorderReady && position >= 0 && position < orderedAll.length - 1
          return <tr key={item.id}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td>{item.mediaType === 'IMAGE'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.mediaUrl} alt="" loading="lazy" className="sp-record-thumb" />
              // eslint-disable-next-line @next/next/no-img-element
              : item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" className="sp-record-thumb" /> : <span className="sp-record-thumb" style={{ display: 'inline-grid', placeItems: 'center', background: '#122a5f', color: '#fff' }}><Film size={18} /></span>}</td>
            <td><strong>{item.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{itemSubtitle(item)}</small></td>
            <td>{item.mediaType === 'IMAGE' ? (ar ? 'صورة' : 'Photo') : (ar ? 'فيديو' : 'Video')}</td>
            <td><small style={{ color: 'var(--sp-muted)' }}>{[item.showOnHomepage ? (ar ? 'الرئيسية' : 'Homepage') : null, item.showOnTours ? (item.tourScope === 'ALL_TOURS' ? (ar ? 'كل الرحلات' : 'All tours') : (ar ? `${item.tourSlugs.length} رحلات` : `${item.tourSlugs.length} tours`)) : null].filter(Boolean).join(' · ') || '-'}</small></td>
            <td>{item.sortOrder}</td>
            <td><span className={`sp-status is-${hidden ? 'cancelled' : 'confirmed'}`}>{hidden ? (ar ? 'مخفية' : 'Hidden') : (ar ? 'منشورة' : 'Published')}</span></td>
            <td><AdminTableActions>
              <AdminIconAction icon={ArrowUp} label={ar ? 'تحريك لأعلى' : 'Move up'} onClick={() => void moveItem(item.id, -1)} disabled={!canMoveUp} />
              <AdminIconAction icon={ArrowDown} label={ar ? 'تحريك لأسفل' : 'Move down'} onClick={() => void moveItem(item.id, 1)} disabled={!canMoveDown} />
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${item.title}` : `Edit ${item.title}`} href={`/admin/gallery/new?id=${encodeURIComponent(item.id)}`} />
              <button type="button" className="sp-icon-btn" onClick={() => void setPublished(item, hidden)} disabled={actionBusy !== ''} aria-label={hidden ? (ar ? `نشر ${item.title}` : `Publish ${item.title}`) : (ar ? `إخفاء ${item.title}` : `Hide ${item.title}`)} title={hidden ? (ar ? 'نشر' : 'Publish') : (ar ? 'إخفاء' : 'Hide')}>{hidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <AdminIconAction icon={Trash2} label={ar ? `حذف ${item.title}` : `Delete ${item.title}`} tone="danger" onClick={() => setDeleteId(item.id)} />
            </AdminTableActions></td>
          </tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No gallery items found" ar="لا توجد عناصر" />} copy={<AdminText en="Try changing the search or filters, or add the first item." ar="جرب تغيير البحث أو الفلاتر، أو أضف أول عنصر." />} />}
      {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      {!reorderReady && rows.length > 0 ? <p style={{ color: 'var(--sp-muted)', fontSize: 12, marginTop: 8 }}>{reorderHint}</p> : null}
    </Card>}
    <AdminConfirmDialog
      open={deleteId !== null}
      onClose={() => setDeleteId(null)}
      onConfirm={() => { if (deleteId) { void removeItem(deleteId) } setDeleteId(null) }}
      title={<AdminText en="Delete this gallery item?" ar="حذف هذا العنصر؟" />}
      description={<AdminText en="Removes it from the homepage and tour pages everywhere. Stored media files are kept." ar="يحذفه من الرئيسية وصفحات الرحلات في كل مكان. تبقى ملفات الوسائط محفوظة." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      cancelLabel={<AdminText en="Keep" ar="تراجع" />}
      tone="danger"
    />
  </>
}
