'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Plus } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminTableTools, AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { ImageField } from '@/components/admin/image-field'
import { SharedSelect } from '@/components/shared-select'
import { invalidateJourneyGalleryCache } from '@/lib/journey-gallery-client'
import {
  MAX_GALLERY_VIDEO_BYTES,
  galleryPlatformLabel,
  parseSocialVideoUrl,
  resolveGalleryVideoSource,
  validateGalleryPayload,
  type GalleryItem,
  type GalleryMediaType,
} from '@/lib/journey-gallery'

export type GalleryEditorFields = {
  mediaType: GalleryMediaType
  videoMode: 'upload' | 'link'
  mediaUrl: string
  title: string
  titleAr: string
  caption: string
  thumbnail: string
  showOnHomepage: boolean
  showOnTours: boolean
  tourScope: 'ALL_TOURS' | 'SELECTED_TOURS'
  tourSlugs: string[]
  sortOrder: string
  isPublished: boolean
}

export const blankGalleryEditor = (mediaType: GalleryMediaType = 'IMAGE'): GalleryEditorFields => ({
  mediaType,
  videoMode: 'upload',
  mediaUrl: '',
  title: '',
  titleAr: '',
  caption: '',
  thumbnail: '',
  showOnHomepage: true,
  showOnTours: false,
  tourScope: 'SELECTED_TOURS',
  tourSlugs: [],
  sortOrder: '999',
  isPublished: true,
})

export function galleryEditorFromItem(item: GalleryItem): GalleryEditorFields {
  return {
    mediaType: item.mediaType,
    videoMode: item.mediaUrl.startsWith('/gallery-videos/') || item.mediaUrl.startsWith('/') ? 'upload' : 'link',
    mediaUrl: item.mediaUrl,
    title: item.title,
    titleAr: item.titleAr ?? '',
    caption: item.caption ?? '',
    thumbnail: item.thumbnail ?? '',
    showOnHomepage: item.showOnHomepage,
    showOnTours: item.showOnTours,
    tourScope: item.tourScope,
    tourSlugs: item.tourSlugs,
    sortOrder: String(item.sortOrder),
    isPublished: item.isPublished,
  }
}

function editorToPayload(editor: GalleryEditorFields) {
  return {
    mediaType: editor.mediaType,
    mediaUrl: editor.mediaUrl.trim(),
    platform: undefined,
    title: editor.title,
    titleAr: editor.titleAr,
    caption: editor.caption,
    thumbnail: editor.thumbnail.trim(),
    showOnHomepage: editor.showOnHomepage,
    showOnTours: editor.mediaType === 'VIDEO' && editor.showOnTours,
    tourScope: editor.tourScope,
    tourSlugs: editor.tourSlugs,
    isPublished: editor.isPublished,
    sortOrder: editor.sortOrder === '' ? 999 : Number(editor.sortOrder),
  }
}

function isCompatibleMediaUrl(mediaType: GalleryMediaType, url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return true
  if (mediaType === 'IMAGE') {
    // Image pipeline paths, legacy public assets, and remote links stay;
    // uploaded videos never belong on a photo.
    return (
      trimmed.startsWith('/media/') ||
      (trimmed.startsWith('/') && !trimmed.startsWith('/gallery-videos/')) ||
      trimmed.startsWith('https://')
    )
  }
  // Social links, uploaded videos, and direct video files stay; image
  // pipeline paths never belong on a video.
  return (
    parseSocialVideoUrl(trimmed) !== null ||
    trimmed.startsWith('/gallery-videos/') ||
    /^https:\/\/[^<>\s]+\.(mp4|webm|ogg)(\?|#|$)/i.test(trimmed)
  )
}

function VideoUploadField({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const ar = useAdminLocale() === 'ar'
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || uploading || disabled) return
    const isVideo = file.type === 'video/mp4' || file.type === 'video/webm' || /\.mp4$/i.test(file.name) || /\.webm$/i.test(file.name)
    if (!isVideo || file.size > MAX_GALLERY_VIDEO_BYTES) {
      setError(ar ? 'MP4 أو WebM فقط وبحد أقصى 5MB.' : 'MP4 or WebM only, max 5 MB.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const body = new FormData()
      body.append('scope', 'gallery-video')
      body.append('file', file, file.name)
      const res = await fetch('/api/media', { method: 'POST', body, credentials: 'same-origin' })
      const data = (await res.json().catch(() => null)) as { media?: { url?: unknown }; error?: unknown } | null
      const url = data?.media?.url
      if (!res.ok || typeof url !== 'string' || !url) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Upload failed.')
      }
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : (ar ? 'تعذر رفع الفيديو.' : 'Could not upload that video.'))
    } finally {
      setUploading(false)
    }
  }
  const source = value ? resolveGalleryVideoSource(value, 'direct') : null
  return <div className="sp-image-field">
    <div className="sp-image-source-grid">
      <label className="sp-image-url-field">
        <span><Film size={14} aria-hidden="true" /><AdminText en="Uploaded video" ar="الفيديو المرفوع" /></span>
        <input value={value} readOnly dir="ltr" placeholder="/gallery-videos/…" disabled={disabled} aria-label={ar ? 'رابط الفيديو المرفوع' : 'Uploaded video URL'} />
      </label>
      <div className="sp-image-upload-field">
        <span><Film size={14} aria-hidden="true" /><AdminText en="Upload MP4/WebM (max 5 MB)" ar="رفع MP4/WebM (بحد أقصى 5MB)" /></span>
        <label className="sp-image-upload-button">
          <Plus size={17} aria-hidden="true" />
          <span>{uploading ? <AdminText en="Uploading…" ar="جارٍ الرفع…" /> : <AdminText en="Choose video" ar="اختيار فيديو" />}</span>
          <input type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={uploading || disabled} onChange={(event) => { void onFile(event.target.files); event.target.value = '' }} />
        </label>
      </div>
    </div>
    {value && source?.kind === 'direct' ? (
      <figure className="sp-image-preview is-wide">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video key={value} src={value} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 220, background: '#000' }} />
      </figure>
    ) : null}
    {error && <p className="sp-image-error" role="alert">{error}</p>}
  </div>
}

export function GalleryForm({ initial, editId }: { initial: GalleryItem | null; editId: string }) {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const editing = Boolean(editId)
  const [fields, setFields] = useState<GalleryEditorFields>(() => (initial ? galleryEditorFromItem(initial) : blankGalleryEditor('IMAGE')))
  const [tours, setTours] = useState<Array<{ slug: string; title: string }>>([])
  const [tourQuery, setTourQuery] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tours', { credentials: 'same-origin' })
        const data = (await res.json()) as { tours?: Array<{ slug?: unknown; title?: unknown }> }
        if (!cancelled && res.ok && Array.isArray(data.tours)) {
          setTours(data.tours.filter((t) => typeof t.slug === 'string' && typeof t.title === 'string').map((t) => ({ slug: t.slug as string, title: t.title as string })).sort((a, b) => a.title.localeCompare(b.title)))
        }
      } catch { /* tour list is optional enhancement */ }
    })()
    return () => { cancelled = true }
  }, [])

  const visibleTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase()
    if (!q) return tours
    return tours.filter((t) => `${t.title} ${t.slug}`.toLowerCase().includes(q))
  }, [tours, tourQuery])

  // Switching photo/video keeps every shared field; only a media URL that
  // cannot belong to the new type is cleared (the preview makes that
  // visible immediately, and validation confirms on save).
  const switchMediaType = (next: GalleryMediaType) => {
    if (next === fields.mediaType) return
    setFields({
      ...fields,
      mediaType: next,
      mediaUrl: isCompatibleMediaUrl(next, fields.mediaUrl) ? fields.mediaUrl : '',
    })
  }

  const save = async () => {
    if (saving) return
    setSaveError('')
    const payload = editorToPayload(fields)
    const known = tours.map((t) => t.slug)
    const check = validateGalleryPayload(payload, known.length ? { knownTourSlugs: known } : undefined)
    if (!check.ok) { setSaveError(check.error); return }
    setSaving(true)
    try {
      const url = editing ? `/api/journey-gallery/${encodeURIComponent(editId)}` : '/api/journey-gallery'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Could not save that item.')
      invalidateJourneyGalleryCache()
      router.push('/admin/gallery')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save that item.')
    } finally {
      setSaving(false)
    }
  }

  const linkHint = fields.mediaType === 'VIDEO' && fields.videoMode === 'link' && fields.mediaUrl.trim()
    ? parseSocialVideoUrl(fields.mediaUrl.trim())
    : null
  const linkInvalid = fields.mediaType === 'VIDEO' && fields.videoMode === 'link' && fields.mediaUrl.trim()
    ? !linkHint && !/^\/[^<>\"\s]*$/.test(fields.mediaUrl.trim()) && !/^https:\/\/[^<>\s]+\.(mp4|webm|ogg)(\?|#|$)/i.test(fields.mediaUrl.trim())
    : false

  return <>
    <PageHead
      eyebrow="Content"
      title={editing ? 'Edit gallery item' : 'New gallery item'}
      titleAr={editing ? 'تعديل عنصر' : 'عنصر جديد'}
      sub={editing ? `Editing ${fields.title || editId}` : 'Photos join the homepage row; videos join the homepage and tour pages'}
      subAr={editing ? `تعديل ${fields.title || editId}` : 'الصور لصف الرئيسية؛ الفيديوهات للرئيسية وصفحات الرحلات'}
      backHref="/admin/gallery"
      actions={<button type="button" className="sp-btn primary" disabled={saving} onClick={() => void save()}>{saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en={editing ? 'Save changes' : 'Create item'} ar={editing ? 'حفظ التعديلات' : 'إنشاء العنصر'} />}</button>}
    />
    <Card title={<AdminText en={editing ? 'Edit gallery item' : 'New gallery item'} ar={editing ? 'تعديل عنصر' : 'عنصر جديد'} />} sub={<AdminText en="Changes appear on the website immediately after saving." ar="تظهر التغييرات على الموقع فور الحفظ." />}>
      <form
        className="sp-form"
        noValidate
        onSubmit={(event) => { event.preventDefault(); void save() }}
      >
        <div className="sp-form-2">
          <label><AdminText en="Type" ar="النوع" /><SharedSelect value={fields.mediaType} onChange={(next) => switchMediaType(next as GalleryMediaType)} locale={ar ? 'ar' : 'en'} label={ar ? 'النوع' : 'Type'} options={[{ value: 'IMAGE', label: ar ? 'صورة (صف الرئيسية)' : 'Photo (homepage row)' }, { value: 'VIDEO', label: ar ? 'فيديو' : 'Video' }]} /></label>
          <label><AdminText en="Order" ar="الترتيب" /><input type="number" min={0} max={999999} value={fields.sortOrder} onChange={(e) => setFields({ ...fields, sortOrder: e.target.value })} dir="ltr" /></label>
        </div>
        {fields.mediaType === 'IMAGE' ? <ImageField value={fields.mediaUrl} onChange={(mediaUrl) => setFields({ ...fields, mediaUrl })} previewAlt={fields.title} linkLabel={{ en: 'Image URL or upload', ar: 'رابط الصورة أو رفعها' }} uploadLabel={{ en: 'Upload photo', ar: 'رفع صورة' }} /> : <>
          <div className="sp-form-2">
            <label><AdminText en="Video source" ar="مصدر الفيديو" /><SharedSelect value={fields.videoMode} onChange={(next) => setFields({ ...fields, videoMode: next as 'upload' | 'link' })} locale={ar ? 'ar' : 'en'} label={ar ? 'مصدر الفيديو' : 'Video source'} options={[{ value: 'upload', label: ar ? 'رفع ملف (MP4/WebM حتى 5MB)' : 'Upload file (MP4/WebM up to 5 MB)' }, { value: 'link', label: ar ? 'رابط سوشيال' : 'Social link' }]} /></label>
            <div><span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}><AdminText en="Detected platform" ar="المنصة المكتشفة" /></span><strong>{fields.mediaUrl.trim() && fields.videoMode === 'link' ? (linkHint ? galleryPlatformLabel(linkHint.platform) : (ar ? 'رابط غير مدعوم' : 'Unsupported link')) : fields.mediaUrl.trim() ? (ar ? 'ملف مرفوع' : 'Uploaded file') : '-'}</strong></div>
          </div>
          {fields.videoMode === 'upload'
            ? <VideoUploadField value={fields.mediaUrl} onChange={(mediaUrl) => setFields({ ...fields, mediaUrl })} />
            : <label><AdminText en="Social video URL (YouTube, Instagram, Facebook, TikTok)" ar="رابط فيديو سوشيال (يوتيوب، انستجرام، فيسبوك، تيك توك)" /><input value={fields.mediaUrl} onChange={(e) => setFields({ ...fields, mediaUrl: e.target.value })} dir="ltr" inputMode="url" placeholder="https://…" /></label>}
          {linkInvalid ? <p className="sp-image-error" role="alert"><AdminText en="Enter a supported public video link, or switch to file upload." ar="أدخل رابط فيديو عام مدعوم، أو استخدم رفع الملفات." /></p> : null}
        </>}
        <div className="sp-form-2">
          <label><AdminText en="Title" ar="العنوان" /><input value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} maxLength={200} autoFocus={!editing} /></label>
          <label><AdminText en="Arabic title (optional)" ar="العنوان بالعربية (اختياري)" /><input value={fields.titleAr} onChange={(e) => setFields({ ...fields, titleAr: e.target.value })} maxLength={200} /></label>
        </div>
        <label><AdminText en="Caption (optional)" ar="وصف مختصر (اختياري)" /><input value={fields.caption} onChange={(e) => setFields({ ...fields, caption: e.target.value })} maxLength={500} /></label>
        {(fields.mediaType === 'VIDEO') ? <ImageField value={fields.thumbnail} onChange={(thumbnail) => setFields({ ...fields, thumbnail })} previewAlt={fields.title} preview="compact" linkLabel={{ en: 'Poster / thumbnail URL (optional)', ar: 'رابط الصورة المصغرة (اختياري)' }} uploadLabel={{ en: 'Upload poster', ar: 'رفع صورة مصغرة' }} /> : null}
        <div className="sp-form-2">
          <label className="sp-check-row"><input type="checkbox" checked={fields.showOnHomepage} onChange={(e) => setFields({ ...fields, showOnHomepage: e.target.checked })} /><span><AdminText en="Show on homepage" ar="عرض في الرئيسية" /><small>{fields.mediaType === 'IMAGE' ? (ar ? 'صف الصور' : 'Photo row') : (ar ? 'صف الفيديوهات' : 'Video row')}</small></span></label>
          {fields.mediaType === 'VIDEO' ? <label className="sp-check-row"><input type="checkbox" checked={fields.showOnTours} onChange={(e) => setFields({ ...fields, showOnTours: e.target.checked })} /><span><AdminText en="Show on tour pages" ar="عرض في صفحات الرحلات" /></span></label> : null}
        </div>
        {fields.mediaType === 'VIDEO' && fields.showOnTours ? <>
          <label><AdminText en="Tour visibility" ar="ظهور الرحلات" /><SharedSelect value={fields.tourScope} onChange={(next) => setFields({ ...fields, tourScope: next as 'ALL_TOURS' | 'SELECTED_TOURS', tourSlugs: next === 'ALL_TOURS' ? [] : fields.tourSlugs })} locale={ar ? 'ar' : 'en'} label={ar ? 'ظهور الرحلات' : 'Tour visibility'} options={[{ value: 'ALL_TOURS', label: ar ? 'كل الرحلات' : 'All tours' }, { value: 'SELECTED_TOURS', label: ar ? 'رحلات محددة' : 'Selected tours' }]} /></label>
          {fields.tourScope === 'SELECTED_TOURS' ? <div>
            <strong style={{ display: 'block', marginBottom: 8 }}><AdminText en="Assign to tours (one video, many tours, never duplicated)" ar="إسناد لرحلات (فيديو واحد لعدة رحلات، بدون تكرار)" /></strong>
            <AdminTableTools query={tourQuery} onQueryChange={setTourQuery} placeholder={ar ? 'ابحث في الرحلات...' : 'Search tours...'}>
              <button type="button" className="sp-btn" onClick={() => setFields({ ...fields, tourSlugs: visibleTours.map((t) => t.slug) })}><AdminText en="Select shown" ar="تحديد الظاهرة" /></button>
              <button type="button" className="sp-btn" onClick={() => setFields({ ...fields, tourSlugs: [] })}><AdminText en="Clear" ar="مسح" /></button>
            </AdminTableTools>
            <div className="sp-check-grid" style={{ maxHeight: 220, overflow: 'auto' }}>
              {visibleTours.map((tour) => <label key={tour.slug} className="sp-check-row"><input type="checkbox" checked={fields.tourSlugs.includes(tour.slug)} onChange={() => setFields({ ...fields, tourSlugs: fields.tourSlugs.includes(tour.slug) ? fields.tourSlugs.filter((s) => s !== tour.slug) : [...fields.tourSlugs, tour.slug] })} /><span>{tour.title}<small dir="ltr">{tour.slug}</small></span></label>)}
            </div>
            {visibleTours.length === 0 ? <p style={{ color: 'var(--sp-muted)', fontSize: 13 }}><AdminText en="No tours match that search." ar="لا توجد رحلات مطابقة لهذا البحث." /></p> : null}
          </div> : null}
        </> : null}
        <label className="sp-check-row"><input type="checkbox" checked={fields.isPublished} onChange={(e) => setFields({ ...fields, isPublished: e.target.checked })} /><span><AdminText en="Published (visible on the website)" ar="منشور (ظاهر على الموقع)" /></span></label>
        {saveError ? <p className="sp-image-error" role="alert">{saveError}</p> : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" className="sp-btn primary" disabled={saving}>{saving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en={editing ? 'Save changes' : 'Create item'} ar={editing ? 'حفظ التعديلات' : 'إنشاء العنصر'} />}</button>
          <Link className="sp-btn" href="/admin/gallery"><AdminText en="Cancel" ar="إلغاء" /></Link>
        </div>
      </form>
    </Card>
  </>
}
