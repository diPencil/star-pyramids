'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { useDbDestinations, invalidateCatalogueCache, dbSlugify } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'
import { ImageField } from '@/components/admin/image-field'
import { destinations } from '@/data/content'
import { assignableOneDayTours, getOneDayToursForDestination } from '@/data/tours'

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)
const oneDayBase = assignableOneDayTours

export default function DestinationEditorPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [editSlug, setEditSlug] = useState('')
  const liveDestinations = useDbDestinations(destinations)
  const liveTours = useDbTours(oneDayBase)
  // Stable record identity: the init effect below re-runs only when the
  // edited record itself (not list identities) changes.
  const editing = useMemo(
    () => (editSlug ? liveDestinations.find((d) => d.slug === editSlug) : undefined),
    [liveDestinations, editSlug],
  )

  const [title, setTitle] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [slug, setSlug] = useState('')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [copyAr, setCopyAr] = useState('')
  const [stay, setStay] = useState('2-3 days')
  const [bestFor, setBestFor] = useState('')
  const [tourSlugs, setTourSlugs] = useState('')
  const [showInDestinations, setShowInDestinations] = useState(true)
  const [showInOneDayTours, setShowInOneDayTours] = useState(false)
  const [published, setPublished] = useState(true)
  const [order, setOrder] = useState('')
  const [linkedSlugs, setLinkedSlugs] = useState<string[]>([])
  const [initialSlugs, setInitialSlugs] = useState<string[]>([])
  const [tourQuery, setTourQuery] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditSlug(new URLSearchParams(window.location.search).get('slug') ?? '')
  }, [])

  useEffect(() => {
    if (editSlug && liveDestinations.length && !editing) { setReady(true); return }
    if (editing) {
      setTitle(editing.title)
      setNameAr(editing.nameAr ?? '')
      setSlug(editing.slug)
      setImage(editing.image)
      setCopy(editing.copy)
      setCopyAr(editing.copyAr ?? '')
      setStay(editing.detail.facts[0]?.value ?? 'Flexible')
      setBestFor(editing.detail.bestFor.join('\n'))
      setTourSlugs(editing.detail.tourSlugs.join(', '))
      setShowInDestinations(editing.showInDestinations !== false)
      setShowInOneDayTours(editing.showInOneDayTours === true)
      setPublished(editing.isPublished !== false)
      setOrder(editing.displayOrder === undefined ? '' : String(editing.displayOrder))
      const linked = getOneDayToursForDestination(liveTours, editing.slug).map((t) => t.slug)
      setLinkedSlugs(linked)
      setInitialSlugs(linked)
    }
    setReady(true)
  }, [editSlug, editing, liveTours])

  const availableTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase()
    return liveTours.filter((t) => !linkedSlugs.includes(t.slug) && (!q || `${t.title} ${t.location} ${t.duration}`.toLowerCase().includes(q)))
  }, [liveTours, linkedSlugs, tourQuery])

  const linkedTours = useMemo(
    () => linkedSlugs.map((s) => liveTours.find((t) => t.slug === s)).filter((t): t is (typeof liveTours)[number] => Boolean(t)),
    [linkedSlugs, liveTours],
  )

  const save = async () => {
    setError('')
    if (!title.trim()) { setError(ar ? 'اكتب اسم الوجهة.' : 'Enter the destination name.'); return }
    const finalSlug = editSlug || dbSlugify(slug.trim() ? slug : title)
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) { setError(ar ? 'الرابط غير صالح.' : 'Invalid slug.'); return }
    const parsedOrder = Number(order)
    const body = {
      title: title.trim(),
      slug: finalSlug,
      image: image.trim(),
      copy: copy.trim() || title.trim(),
      nameAr: nameAr.trim() || undefined,
      copyAr: copyAr.trim() || undefined,
      showInOneDayTours: showInOneDayTours || undefined,
      showInDestinations: showInDestinations ? undefined : false,
      isPublished: published ? undefined : false,
      displayOrder: order.trim() === '' || !Number.isFinite(parsedOrder) ? undefined : parsedOrder,
      detail: {
        heroImage: image.trim(),
        heroAlt: title.trim(),
        eyebrow: editing?.detail.eyebrow ?? 'Discover Egypt',
        intro: copy.trim() || title.trim(),
        facts: [{ label: 'Suggested stay', value: stay.trim() || 'Flexible' }],
        bestFor: lines(bestFor),
        experiences: editing?.detail.experiences ?? [],
        rhythm: editing?.detail.rhythm ?? [],
        practical: editing?.detail.practical ?? [],
        tourSlugs: tourSlugs.split(',').map((s) => s.trim()).filter(Boolean),
      },
    }
    // Destination record is DB-authoritative (POST for new, PUT for edit).
    if (saving) return
    setSaving(true)
    try {
      const url = editSlug
        ? `/api/destinations/${encodeURIComponent(editSlug)}`
        : '/api/destinations'
      const res = await fetch(url, {
        method: editSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save destination.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save destination.')
      setSaving(false)
      return
    }
    // Tour assignments stay DB-authoritative alongside the record.
    try {
      const failures: string[] = []
      const putTour = async (tourSlug: string, destinationSlug: string | null) => {
        try {
          const res = await fetch(`/api/tours/${encodeURIComponent(tourSlug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinationSlug }),
            credentials: 'same-origin',
          })
          if (!res.ok) failures.push(tourSlug)
        } catch {
          failures.push(tourSlug)
        }
      }
      for (const tourSlug of linkedSlugs) {
        const base = liveTours.find((t) => t.slug === tourSlug)
        if (!base || base.category !== 'one-day-tours') continue
        await putTour(tourSlug, finalSlug)
      }
      for (const tourSlug of initialSlugs.filter((s) => !linkedSlugs.includes(s))) {
        await putTour(tourSlug, null)
      }
      if (failures.length) {
        setError(ar ? `تعذر حفظ ارتباط الرحلات في قاعدة البيانات: ${failures.join(', ')}` : `Could not save tour links to the database: ${failures.join(', ')}`)
        return
      }
      invalidateCatalogueCache()
      router.push('/admin/destinations')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHead eyebrow="Catalogue" title={editSlug ? 'Edit destination' : 'New destination'} titleAr={editSlug ? 'تعديل الوجهة' : 'وجهة جديدة'} sub={ar ? 'تنشر في الوجهات والرئيسية' : 'Published to destinations and the homepage'} backHref="/admin/destinations" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving}><AdminText en="Save destination" ar="حفظ الوجهة" /></button>} />
    {!ready ? <Card title={<AdminText en="Loading" ar="جار التحميل" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="Loading destination..." ar="جار تحميل الوجهة..." /></p></Card> : editSlug && !editing ? (
      <Card title={<AdminText en="Destination not found" ar="الوجهة غير موجودة" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="The requested destination does not exist." ar="الوجهة المطلوبة غير موجودة." /></p></Card>
    ) : <>
      <Card title={<AdminText en="Basic information" ar="البيانات الأساسية" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label><AdminText en="Name (EN)" ar="الاسم (EN)" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Siwa Oasis" /></label>
            <label><AdminText en="Name (AR)" ar="الاسم (AR)" /><input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="واحة سيوة" /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Slug" ar="الرابط" /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="siwa-oasis" dir="ltr" readOnly={Boolean(editSlug)} /></label>
            <label><AdminText en="Suggested stay" ar="مدة الإقامة المقترحة" /><input value={stay} onChange={(e) => setStay(e.target.value)} /></label>
          </div>
        </div>
      </Card>
      <Card title={<AdminText en="Content" ar="المحتوى" />}>
        <div className="sp-form">
          <label><AdminText en="Description (EN)" ar="الوصف (EN)" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
          <label><AdminText en="Description (AR)" ar="الوصف (AR)" /><textarea rows={3} value={copyAr} onChange={(e) => setCopyAr(e.target.value)} /></label>
          <label><AdminText en="Best for (one per line)" ar="مناسبة لـ (سطر لكل بند)" /><textarea rows={3} value={bestFor} onChange={(e) => setBestFor(e.target.value)} /></label>
          <label><AdminText en="Linked tour slugs (comma separated)" ar="الرحلات المرتبطة (slugs مفصولة بفاصلة)" /><input value={tourSlugs} onChange={(e) => setTourSlugs(e.target.value)} placeholder="cairo-and-giza-pyramids" dir="ltr" /></label>
        </div>
      </Card>
      <Card title={<AdminText en="Media" ar="الوسائط" />} sub={<AdminText en="Cover image" ar="صورة الغلاف" />}>
        <ImageField value={image} onChange={setImage} />
      </Card>
      <Card title={<AdminText en="Publishing" ar="النشر" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span><AdminText en="Published" ar="منشور" /><small><AdminText en="Hidden destinations disappear from the website" ar="الوجهات المخفية تختفي من الموقع" /></small></span></label>
            <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} dir="ltr" /></label>
          </div>
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={showInDestinations} onChange={(e) => setShowInDestinations(e.target.checked)} /><span><AdminText en="Show on destinations page" ar="الظهور في صفحة الوجهات" /><small><AdminText en="Editorial landing pages and homepage" ar="صفحات الهبوط التحريرية والرئيسية" /></small></span></label>
            <label className="sp-check-row"><input type="checkbox" checked={showInOneDayTours} onChange={(e) => setShowInOneDayTours(e.target.checked)} /><span><AdminText en="Show in One Day Tours" ar="الظهور في رحلات اليوم الواحد" /><small><AdminText en="Discovery section on the One Day Tours page" ar="قسم الاستكشاف في صفحة رحلات اليوم الواحد" /></small></span></label>
          </div>
        </div>
      </Card>
      <Card title={<AdminText en="One Day Tours" ar="رحلات اليوم الواحد" />} sub={<AdminText en="This destination appears on One Day Tours with these tours" ar="تظهر هذه الوجهة في رحلات اليوم الواحد مع هذه الرحلات" />}>
        <div className="sp-form">
          {linkedTours.length ? <div className="sp-repeat-list">{linkedTours.map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span>{tour.image ? <img src={tour.image} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} /> : '•'}</span><strong>{tour.title}</strong><button type="button" className="sp-icon-btn danger" onClick={() => setLinkedSlugs((current) => current.filter((s) => s !== tour.slug))} aria-label={ar ? `إزالة ${tour.title}` : `Remove ${tour.title}`} title={ar ? 'إزالة' : 'Remove'}><Trash2 size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p className="sp-builder-note"><AdminText en="No one-day tours linked yet. Without tours, this destination stays off the public One Day Tours page." ar="لا توجد رحلات يوم واحد مرتبطة بعد. بدون رحلات، تبقى هذه الوجهة خارج صفحة رحلات اليوم الواحد العامة." /></p>}
          <label><AdminText en="Add one-day tour" ar="إضافة رحلة يوم واحد" />
            <input value={tourQuery} onChange={(e) => setTourQuery(e.target.value)} placeholder={ar ? 'ابحث في الرحلات...' : 'Search tours...'} />
          </label>
          {tourQuery.trim() && (availableTours.length ? <div className="sp-repeat-list">{availableTours.slice(0, 6).map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span><Plus size={15} /></span><strong>{tour.title}</strong><button type="button" onClick={() => { setLinkedSlugs((current) => [...current, tour.slug]); setTourQuery('') }} aria-label={ar ? `إضافة ${tour.title}` : `Add ${tour.title}`} title={ar ? 'إضافة' : 'Add'}><Plus size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p style={{ color: 'var(--sp-muted)' }}><AdminText en="No matching tours." ar="لا توجد رحلات مطابقة." /></p>)}
        </div>
      </Card>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en="Save destination" ar="حفظ الوجهة" /></button>
        {editSlug && <Link className="sp-btn" href={showInDestinations ? `/destinations/${editSlug}` : `/egypt-tours/one-day-tours/${editSlug}`}><ExternalLink size={16} /> <AdminText en="View destination" ar="عرض الوجهة" /></Link>}
      </div>
    </>}
  </>
}
